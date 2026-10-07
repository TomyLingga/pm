<?php

namespace Tests\Feature\Pm;

use App\Models\Attachment;
use App\Models\PmTask;
use App\Notifications\DocumentNotification;
use App\Notifications\WorkOrderNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\PmFixtures;
use Tests\TestCase;

/** Working on a PM task: checklist, photos, materials, findings → Work Order, skip and reassign. */
class PmTaskExecutionTest extends TestCase
{
    use PmFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpPm();
        Storage::fake('local');
    }

    private function photo(int $taskId, ?int $itemId = null)
    {
        return $this->postJson("/api/v1/pm-tasks/{$taskId}/attachments", array_filter([
            'file' => UploadedFile::fake()->image('foto.jpg', 640, 480),
            'item_id' => $itemId,
        ]));
    }

    public function test_checklist_is_filled_in_and_the_task_completed(): void
    {
        $task = $this->dueTask();

        // Before start: the checklist is a preview of the template
        $detail = $this->actingAsUser($this->tech1)->getJson("/api/v1/pm-tasks/{$task->id}")->assertOk()->json('data');
        $this->assertSame(sprintf('PM-%06d', $task->id), $detail['number']);
        $this->assertSame('due', $detail['status']);
        $this->assertSame('JATUH_TEMPO', $detail['status_label']);
        $this->assertSame('SCN-01', $detail['equipment']['code']);
        $this->assertSame('Kantor Pengadaan', $detail['equipment']['location_name']);
        $this->assertSame('Mingguan', $detail['schedule']['frequency_label']);
        $this->assertCount(4, $detail['checklist_preview']);
        $this->assertSame([], $detail['items']);
        $this->assertTrue($detail['permissions']['can_start']);
        $this->assertFalse($detail['permissions']['can_complete']);
        $this->assertFalse($detail['permissions']['can_skip'], 'technicians cannot skip');
        $this->assertTrue($detail['permissions']['can_propose_skip']);

        // The lead adds a line to the template: tasks not started yet follow the template
        $template = $this->actingAsUser($this->itLead)->getJson("/api/v1/checklist-templates/{$detail['checklist_template']['id']}")->json('data');
        $this->actingAsUser($this->itLead)->putJson("/api/v1/checklist-templates/{$template['id']}", $this->templatePayload([
            'items' => array_merge($template['items'], [['description' => 'Cek indikator alarm', 'input_type' => 'ok_nok_na', 'is_required' => false]]),
        ]))->assertOk();

        // Start
        $detail = $this->pmAction($this->tech1, $task->id, 'start')->assertOk()->json('data');
        $this->assertSame('in_progress', $detail['status']);
        $this->assertSame($this->tech1->id, $detail['started_by']['id']);
        $this->assertSame([], $detail['checklist_preview']);
        $this->assertCount(5, $detail['items'], 'copied from the template as it is at start time');
        $this->assertTrue($detail['permissions']['can_work']);
        [$physical, $voltage, $temperature, $cleanliness, $alarm] = $detail['items'];
        $this->assertNull($physical['result']);
        $this->pmAction($this->tech1, $task->id, 'start')->assertStatus(409);

        // Auto-save: partial answers, numbers are judged against min/max by the server
        $detail = $this->pmAction($this->tech1, $task->id, 'items', ['items' => [
            ['id' => $physical['id'], 'result' => 'ok'],
            ['id' => $voltage['id'], 'value_number' => 240.5],
        ]], 'putJson')->assertOk()->json('data');
        $this->assertSame(['ok', 'OK'], [$detail['items'][0]['result'], $detail['items'][0]['result_label']]);
        $this->assertSame('not_ok', $detail['items'][1]['result'], '240.5 V is outside 210–230');
        $this->assertSame(1, $detail['findings_count']);

        $detail = $this->pmAction($this->tech1, $task->id, 'items', ['items' => [
            ['id' => $voltage['id'], 'value_number' => 221, 'notes' => 'Stabil'],
            ['id' => $temperature['id'], 'value_text' => '23 °C'],
            ['id' => $alarm['id'], 'result' => 'na'],
        ]], 'putJson')->assertOk()->json('data');
        $this->assertSame('ok', $detail['items'][1]['result']);
        $this->assertSame('Stabil', $detail['items'][1]['notes']);
        $this->assertSame('ok', $detail['items'][0]['result'], 'untouched items keep their answer');
        $this->assertSame('ok', $detail['items'][2]['result'], 'text answers count as OK once filled');
        $this->assertSame(['na', 'N/A'], [$detail['items'][4]['result'], $detail['items'][4]['result_label']]);

        $this->pmAction($this->tech1, $task->id, 'items', ['items' => [['id' => 999999, 'result' => 'ok']]], 'putJson')
            ->assertStatus(422)->assertJsonValidationErrors('items.0.id');
        $this->pmAction($this->tech1, $task->id, 'items', ['items' => [['id' => $physical['id'], 'result' => 'bagus']]], 'putJson')
            ->assertStatus(422)->assertJsonValidationErrors('items.0.result');

        // Complete: the required item and the mandatory photo are still missing
        $key = "items.{$cleanliness['id']}"; // errors are keyed per checklist item
        $errors = $this->pmAction($this->tech1, $task->id, 'complete', ['duration_minutes' => 45])->assertStatus(422)->json('errors');
        $this->assertSame([$key => ['Butir wajib ini belum diisi.', 'Butir ini wajib dilengkapi foto.']], $errors);

        $errors = $this->pmAction($this->tech1, $task->id, 'complete', [
            'items' => [['id' => $cleanliness['id'], 'result' => 'not_ok', 'notes' => 'Debu tebal di rak']],
        ])->assertStatus(422)->json('errors');
        $this->assertSame([$key => ['Butir ini wajib dilengkapi foto.']], $errors);
        $this->assertSame('in_progress', $task->fresh()->status->value);

        // Photo from the phone camera for that item, plus a general photo and materials
        $this->actingAsUser($this->tech1);
        $itemPhoto = $this->photo($task->id, $cleanliness['id'])->assertCreated()->json('data');
        $this->photo($task->id)->assertCreated()->assertJsonPath('data.collection', 'photo');
        $this->photo($task->id, 999999)->assertStatus(422)->assertJsonValidationErrors('item_id');

        $detail = $this->pmAction($this->tech1, $task->id, 'materials', ['materials' => [
            ['material_id' => $this->material->id, 'quantity' => 1.5],
            ['material_name' => 'Kain lap', 'quantity' => 2, 'unit' => 'pcs'],
        ]], 'putJson')->assertOk()->json('data');
        $this->assertSame(['Kabel LAN', 'Kain lap'], array_column($detail['materials'], 'material_name'));
        $this->assertCount(1, $detail['attachments']);
        $this->assertSame($itemPhoto['id'], $detail['items'][3]['attachments'][0]['id']);

        // Colleagues of the unit can open the photo, outsiders cannot
        $this->actingAsUser($this->tech2)->get($itemPhoto['url'])->assertOk();
        $this->actingAsUser($this->outsider)->get($itemPhoto['url'])->assertForbidden();

        // Complete
        $detail = $this->pmAction($this->tech1, $task->id, 'complete', ['duration_minutes' => 45, 'notes' => 'Perlu pembersihan menyeluruh'])
            ->assertOk()->json('data');
        $this->assertSame('completed', $detail['status']);
        $this->assertSame('SELESAI', $detail['status_label']);
        $this->assertSame($this->tech1->id, $detail['completed_by']['id']);
        $this->assertSame(45, $detail['duration_minutes']);
        $this->assertFalse($detail['is_late']);
        $this->assertSame(1, $detail['findings_count']);
        $this->assertSame(['due', 'start', 'complete'], array_column($detail['logs'], 'action'));
        $this->assertTrue($detail['permissions']['can_create_work_order']);
        $this->assertFalse($detail['permissions']['can_work']);

        // Nothing can be changed afterwards
        $this->pmAction($this->tech1, $task->id, 'items', ['items' => [['id' => $physical['id'], 'result' => 'not_ok']]], 'putJson')->assertStatus(409);
        $this->actingAsUser($this->tech1)->deleteJson($itemPhoto['url'])->assertStatus(409);
        $this->actingAsUser($this->tech1);
        $this->photo($task->id)->assertStatus(409);
    }

    public function test_work_order_is_raised_from_a_not_ok_finding(): void
    {
        $task = $this->dueTask();
        $items = $this->pmAction($this->tech1, $task->id, 'start')->json('data.items');
        [$physical, , , $cleanliness] = $items;
        $this->pmAction($this->tech1, $task->id, 'items', ['items' => [
            ['id' => $physical['id'], 'result' => 'ok'],
            ['id' => $cleanliness['id'], 'result' => 'not_ok', 'notes' => 'Fan berisik, bearing aus'],
        ]], 'putJson')->assertOk();
        $url = fn (array $item) => "items/{$item['id']}/work-order";
        $body = ['service_category_id' => $this->hardware->id, 'priority' => 'high'];

        // Only for "Tidak OK" items, with a category of the executor unit
        $this->pmAction($this->tech1, $task->id, $url($physical), $body)->assertStatus(422)->assertJsonValidationErrors('item');
        $this->pmAction($this->tech1, $task->id, $url($cleanliness), ['service_category_id' => $this->mtcCategory->id, 'priority' => 'high'])
            ->assertStatus(422)->assertJsonValidationErrors('service_category_id');
        $this->pmAction($this->outsider, $task->id, $url($cleanliness), $body)->assertForbidden();

        $detail = $this->pmAction($this->tech1, $task->id, $url($cleanliness), $body)->assertCreated()->json('data');
        $workOrder = $detail['items'][3]['work_order'];
        $this->assertSame('WO/IT/X/2026/0001', $workOrder['wo_number']);
        $this->assertSame('submitted', $workOrder['status']);
        $this->assertSame('create_work_order', collect($detail['logs'])->last()['action']);

        // The Work Order is pre-filled with the equipment and points back to the PM task
        $wo = $this->actingAsUser($this->tech1)->getJson("/api/v1/work-orders/{$workOrder['id']}")->assertOk()->json('data');
        $this->assertSame($this->tech1->id, $wo['requester']['id']);
        $this->assertSame('SCN-01', $wo['equipment_code']);
        $this->assertSame($this->location->id, $wo['location']['id']);
        $this->assertSame('high', $wo['priority']);
        $this->assertSame("Temuan PM {$detail['number']}: Kebersihan area perangkat — Fan berisik, bearing aus", $wo['request_description']);
        $this->assertSame(
            ['id' => $task->id, 'number' => $detail['number'], 'item_description' => 'Kebersihan area perangkat'],
            $wo['source_pm_task']
        );
        Notification::assertSentTo($this->tech2, WorkOrderNotification::class, fn ($n) => $n->event === 'work_order.created' && $n->alarm);

        // Once per finding
        $this->pmAction($this->tech1, $task->id, $url($cleanliness), $body)
            ->assertStatus(409)->assertJsonFragment(['message' => 'Work Order untuk temuan ini sudah dibuat.']);

        // Another executor can be chosen, with its own category and a custom description
        $this->pmAction($this->tech1, $task->id, 'items', ['items' => [['id' => $physical['id'], 'result' => 'not_ok']]], 'putJson')->assertOk();
        $detail = $this->pmAction($this->tech1, $task->id, $url($physical), [
            'executor_unit_id' => $this->mtc->id, 'service_category_id' => $this->mtcCategory->id, 'priority' => 'medium',
            'request_description' => 'Dudukan rak retak, perlu las',
        ])->assertCreated()->json('data');
        $this->assertSame('WO/MTC/X/2026/0001', $detail['items'][0]['work_order']['wo_number']);
    }

    public function test_task_cannot_be_started_before_its_window_and_late_completion_is_flagged(): void
    {
        $schedule = $this->createSchedule(['equipment_ids' => [$this->equipment->id]]);
        $task = $this->tasksOf($schedule['id'])->first();

        $this->pmAction($this->tech1, $task->id, 'start')
            ->assertStatus(409)
            ->assertJsonFragment(['message' => sprintf('Tugas PM-%06d baru dapat dikerjakan mulai 10 Okt 2026 08:00.', $task->id)]);

        // Past due + tolerance: TERLAMBAT, but it can still be done — and is marked late
        $this->checkOverdueAt('2026-10-13 09:00');
        $this->assertSame('overdue', $task->fresh()->status->value);
        $items = $this->pmAction($this->tech2, $task->id, 'start')->assertOk()->json('data.items');

        $this->actingAsUser($this->tech2)->postJson("/api/v1/pm-tasks/{$task->id}/attachments", [
            'file' => UploadedFile::fake()->image('bersih.jpg'), 'item_id' => $items[3]['id'],
        ])->assertCreated();
        $this->travelTo($this->wib('2026-10-13 09:40'));
        $detail = $this->pmAction($this->tech2, $task->id, 'complete', ['items' => [
            ['id' => $items[0]['id'], 'result' => 'ok'],
            ['id' => $items[1]['id'], 'value_number' => 220],
            ['id' => $items[3]['id'], 'result' => 'ok'],
        ]])->assertOk()->json('data');

        $this->assertSame('completed', $detail['status']);
        $this->assertTrue($detail['is_late']);
        $this->assertSame(40, $detail['duration_minutes'], 'defaults to the time since start');
        $this->assertSame($this->tech2->id, $detail['completed_by']['id'], 'any staff of the unit may do the work');
        $this->assertSame($this->tech1->id, $detail['pic']['id']);
    }

    public function test_technician_proposes_a_skip_and_only_a_lead_can_skip_or_reassign(): void
    {
        $task = $this->dueTask();

        // Technician: propose only
        $this->pmAction($this->tech1, $task->id, 'skip', ['reason' => 'Alat dipinjam'])->assertForbidden();
        $this->pmAction($this->tech1, $task->id, 'propose-skip', [])->assertStatus(422)->assertJsonValidationErrors('reason');
        $detail = $this->pmAction($this->tech1, $task->id, 'propose-skip', ['reason' => 'Alat sedang dipinjam vendor'])->assertOk()->json('data');
        $this->assertSame('due', $detail['status']);
        $this->assertTrue($detail['has_skip_proposal']);
        $this->assertSame('Alat sedang dipinjam vendor', $detail['skip_proposal']['reason']);
        $this->assertSame($this->tech1->id, $detail['skip_proposal']['by']['id']);
        Notification::assertSentTo($this->itLead, DocumentNotification::class,
            fn (DocumentNotification $n) => $n->event === 'pm_task.skip_proposed' && $n->documentId === $task->id && ! $n->alarm);

        // Reassign
        $this->pmAction($this->tech1, $task->id, 'reassign', ['pic_user_id' => $this->tech2->id])->assertForbidden();
        $this->pmAction($this->itLead, $task->id, 'reassign', ['pic_user_id' => $this->mtcTech->id])
            ->assertStatus(422)->assertJsonValidationErrors('pic_user_id');
        $detail = $this->pmAction($this->itLead, $task->id, 'reassign', ['pic_user_id' => $this->tech2->id])->assertOk()->json('data');
        $this->assertSame($this->tech2->id, $detail['pic']['id']);
        Notification::assertSentTo($this->tech2, DocumentNotification::class, fn (DocumentNotification $n) => $n->event === 'pm_task.reassigned');

        // Lead skips
        $this->pmAction($this->itLead, $task->id, 'skip', [])->assertStatus(422)->assertJsonValidationErrors('reason');
        $detail = $this->pmAction($this->itLead, $task->id, 'skip', ['reason' => 'Disetujui, alat di vendor'])->assertOk()->json('data');
        $this->assertSame('skipped', $detail['status']);
        $this->assertSame('DILEWATI', $detail['status_label']);
        $this->assertSame('Disetujui, alat di vendor', $detail['skip_reason']);
        $this->assertSame($this->itLead->id, $detail['skipped_by']['id']);
        $this->assertFalse($detail['has_skip_proposal']);
        $this->assertSame(['due', 'propose_skip', 'reassign', 'skip'], array_column($detail['logs'], 'action'));
        Notification::assertSentTo($this->tech2, DocumentNotification::class, fn (DocumentNotification $n) => $n->event === 'pm_task.skipped');

        // Final
        $this->pmAction($this->tech2, $task->id, 'start')->assertStatus(409);
        $this->pmAction($this->itLead, $task->id, 'skip', ['reason' => 'lagi'])->assertStatus(409);
    }

    public function test_access_and_photo_limits(): void
    {
        $task = $this->dueTask();
        $url = "/api/v1/pm-tasks/{$task->id}";

        $this->actingAsUser($this->outsider)->getJson($url)->assertForbidden();
        $this->actingAsUser($this->requester)->getJson($url)->assertForbidden();
        $this->pmAction($this->mtcTech, $task->id, 'start')->assertForbidden();
        $this->actingAsUser($this->tech2)->getJson($url)->assertOk()->assertJsonPath('data.permissions.can_start', true);
        $this->actingAsUser($this->itLead)->getJson($url)
            ->assertJsonPath('data.permissions.can_skip', true)->assertJsonPath('data.permissions.can_reassign', true);

        // Photos only while the task is being worked on
        $this->actingAsUser($this->tech1);
        $this->photo($task->id)->assertStatus(409);
        $item = $this->pmAction($this->tech1, $task->id, 'start')->json('data.items.0');
        $this->actingAsUser($this->outsider);
        $this->photo($task->id)->assertForbidden();

        $this->actingAsUser($this->tech1);
        $this->postJson("{$url}/attachments", ['file' => UploadedFile::fake()->create('script.exe', 10)])
            ->assertStatus(422)->assertJsonValidationErrors('file');
        for ($i = 0; $i < 5; $i++) {
            $photo = $this->photo($task->id, $item['id'])->assertCreated()->json('data');
        }
        $this->photo($task->id, $item['id'])->assertStatus(422)->assertJsonPath('errors.file.0', 'Maksimal 5 lampiran per butir.');

        // Only the uploader removes a photo
        $this->actingAsUser($this->tech2)->deleteJson($photo['url'])->assertForbidden();
        $this->actingAsUser($this->tech1)->deleteJson($photo['url'])->assertNoContent();
        $this->assertSame(4, Attachment::query()->where('attachable_type', 'pm_task_item')->count());
        $this->assertSame(1, PmTask::query()->where('status', 'in_progress')->count());
    }
}
