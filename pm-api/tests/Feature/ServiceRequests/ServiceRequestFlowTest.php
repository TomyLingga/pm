<?php

namespace Tests\Feature\ServiceRequests;

use App\Models\ApprovalStep;
use App\Models\DocumentSignature;
use App\Notifications\DocumentNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Tests\Concerns\ServiceRequestFixtures;
use Tests\TestCase;

/** The four scenarios of Module B: success, rejected by superior, rejected by division, revision. */
class ServiceRequestFlowTest extends TestCase
{
    use RefreshDatabase;
    use ServiceRequestFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpServiceRequests();
        Notification::fake();
        $this->travelTo(Carbon::parse('2026-10-06 09:00', 'Asia/Jakarta'));
    }

    private function sentTo($users, string $event, bool $alarm = false): void
    {
        Notification::assertSentTo($users, DocumentNotification::class,
            fn (DocumentNotification $n) => $n->event === $event && $n->alarm === $alarm && $n->documentType === 'service_request');
    }

    public function test_successful_flow_superior_then_division_then_foreman(): void
    {
        // Draft: superior defaults to Portal atasan_id
        $draft = $this->createRequest();
        $this->assertSame('draft', $draft['status']);
        $this->assertNull($draft['request_number']);
        $this->assertSame($this->superior->id, $draft['superior']['id']);
        $this->assertSame([], $draft['approval_steps']);
        $this->assertTrue($draft['permissions']['can_submit']);
        $this->assertStringContainsString('IT Security Policy INL', $draft['rules']);

        // Submit
        $sr = $this->requestAction($this->requester, $draft['id'], 'submit')->assertOk()->json('data');
        $this->assertSame('REQ0001/IT/X/2026', $sr['request_number']);
        $this->assertSame('waiting_superior', $sr['status']);
        $this->assertSame('MENUNGGU_ATASAN', $sr['status_label']);
        $this->assertSame(
            ['submission' => 'completed', 'superior' => 'pending', 'executor_lead' => 'waiting', 'executor' => 'waiting'],
            $this->stepStatuses($sr)
        );
        $this->assertSame('Indra Sakti Lubis', $sr['current_step']['assignee_label']);
        $this->assertSame([
            'name' => 'Muhammad Adib Nugraha', 'employment_status' => 'Karyawan Tetap', 'nrk' => '119090170',
            'position' => 'Staf', 'superior_name' => 'Indra Sakti Lubis', 'bagian' => 'Keuangan & Pengadaan',
            'sub_bagian' => 'Pengadaan', 'email' => $this->requester->email, 'phone' => '085322762975',
        ], $sr['identity']);
        $this->assertSame($this->superior->id, $this->requester->fresh()->preferred_superior_id, 'choice remembered');
        $this->sentTo($this->superior, 'service_request.submitted');
        Notification::assertNotSentTo([$this->itLead, $this->tech1], DocumentNotification::class);

        // "Menunggu Persetujuan Saya"
        $inbox = $this->actingAsUser($this->superior)->getJson('/api/v1/approvals/pending')->assertOk()->json('data');
        $this->assertSame([$sr['id']], array_column($inbox, 'document_id'));
        $this->assertSame('approve', $inbox[0]['action']);
        $this->assertSame('Atasan YBS', $inbox[0]['step_label']);
        $this->actingAsUser($this->itLead)->getJson('/api/v1/approvals/pending-count')->assertJsonPath('data.count', 0);

        // 1. Atasan YBS approves
        $this->travelTo(now()->addDay());
        $sr = $this->requestAction($this->superior, $sr['id'], 'approve', ['notes' => 'OK, lanjutkan'])->assertOk()->json('data');
        $this->assertSame('waiting_executor', $sr['status']);
        $this->assertSame('approved', $this->stepStatuses($sr)['superior']);
        $this->assertSame('pending', $this->stepStatuses($sr)['executor_lead']);
        $this->assertSame('Pimpinan Sistem dan IT', $sr['current_step']['assignee_label']);
        $this->sentTo($this->itLead, 'service_request.step_pending');
        $this->actingAsUser($this->itLead)->getJson('/api/v1/approvals/pending-count')->assertJsonPath('data.count', 1);
        $this->actingAsUser($this->tech1)->getJson('/api/v1/approvals/pending-count')->assertJsonPath('data.count', 0);

        // 2. Mgr/Spv Divisi approves and appoints the foreman
        $this->travelTo(now()->addDays(5));
        $sr = $this->requestAction($this->itLead, $sr['id'], 'approve', ['assigned_executor_id' => $this->tech1->id])
            ->assertOk()->json('data');
        $this->assertSame('in_progress', $sr['status']);
        $this->assertSame($this->tech1->id, $sr['assigned_executor']['id']);
        $executorStep = collect($sr['approval_steps'])->firstWhere('key', 'executor');
        $this->assertSame('pending', $executorStep['status']);
        $this->assertSame($this->tech1->id, $executorStep['assignee_user']['id']);
        $this->sentTo($this->requester, 'service_request.approved');
        $this->sentTo($this->tech1, 'service_request.step_pending');

        // 3. Only the appointed foreman can finish
        $this->requestAction($this->tech2, $sr['id'], 'complete', ['executor_notes' => 'done'])->assertForbidden();
        $this->requestAction($this->tech1, $sr['id'], 'complete', [])->assertStatus(422)->assertJsonValidationErrors('executor_notes');
        $sr = $this->requestAction($this->tech1, $sr['id'], 'complete', ['executor_notes' => 'done'])->assertOk()->json('data');

        $this->assertSame('completed', $sr['status']);
        $this->assertSame('SELESAI', $sr['status_label']);
        $this->assertSame('done', $sr['executor_notes']);
        $this->assertNull($sr['current_step']);
        $this->assertSame(
            ['submission' => 'completed', 'superior' => 'approved', 'executor_lead' => 'approved', 'executor' => 'completed'],
            $this->stepStatuses($sr)
        );
        $this->assertSame(
            [['Muhammad Adib Nugraha', '085322762975'], ['Indra Sakti Lubis', '085761959096'], ['Oka Aritonang', '085375913300'], ['Tomy Lingga', '082178546887']],
            collect($sr['approval_steps'])->map(fn ($s) => [$s['actor_name'], $s['actor_phone']])->all()
        );
        $this->assertEqualsCanonicalizing(['submission', 'superior', 'executor_lead', 'executor'], array_column($sr['signatures'], 'role_key'));
        $this->assertSame(['create', 'submit', 'approve', 'approve', 'complete'], array_column($sr['logs'], 'action'));
        $this->assertFalse(in_array(true, $sr['permissions'], true), 'nothing left to do');
        $this->sentTo($this->requester, 'service_request.completed');
    }

    public function test_rejected_by_superior(): void
    {
        $sr = $this->submittedRequest();

        $this->requestAction($this->superior, $sr['id'], 'reject', [])->assertStatus(422)->assertJsonValidationErrors('notes');
        $sr = $this->requestAction($this->superior, $sr['id'], 'reject', ['notes' => 'Anggaran belum tersedia'])->assertOk()->json('data');

        $this->assertSame('rejected', $sr['status']);
        $this->assertSame('DITOLAK', $sr['status_label']);
        $this->assertNotNull($sr['rejected_at']);
        $this->assertSame(
            ['submission' => 'completed', 'superior' => 'rejected', 'executor_lead' => 'cancelled', 'executor' => 'cancelled'],
            $this->stepStatuses($sr)
        );
        $superiorStep = collect($sr['approval_steps'])->firstWhere('key', 'superior');
        $this->assertSame('Anggaran belum tersedia', $superiorStep['notes']);
        $this->assertSame($this->superior->id, $superiorStep['acted_by']['id']);
        $this->sentTo($this->requester, 'service_request.rejected', true);

        // Final: nobody can continue, the requester cannot cancel anymore
        $this->requestAction($this->itLead, $sr['id'], 'approve')->assertForbidden();
        $this->requestAction($this->requester, $sr['id'], 'cancel', ['reason' => 'x'])->assertStatus(409);
        $this->actingAsUser($this->superior)->getJson('/api/v1/approvals/pending-count')->assertJsonPath('data.count', 0);
    }

    public function test_rejected_by_division(): void
    {
        $sr = $this->submittedRequest();
        $this->requestAction($this->superior, $sr['id'], 'approve')->assertOk();

        // The superior is no longer the active approver
        $this->requestAction($this->superior, $sr['id'], 'reject', ['notes' => 'x'])->assertForbidden();
        // Technicians are not Mgr/Spv
        $this->requestAction($this->tech1, $sr['id'], 'reject', ['notes' => 'x'])->assertForbidden();

        $sr = $this->requestAction($this->itLead, $sr['id'], 'reject', ['notes' => 'Scanner sudah di luar garansi, ajukan pembelian baru'])
            ->assertOk()->json('data');

        $this->assertSame('rejected', $sr['status']);
        $this->assertSame(
            ['submission' => 'completed', 'superior' => 'approved', 'executor_lead' => 'rejected', 'executor' => 'cancelled'],
            $this->stepStatuses($sr)
        );
        $this->assertSame('reject', collect($sr['logs'])->last()['action']);
        $this->assertSame('waiting_executor', collect($sr['logs'])->last()['from_status']);
        $this->sentTo($this->requester, 'service_request.rejected', true);
    }

    public function test_revision_restarts_the_chain_from_the_superior(): void
    {
        $sr = $this->submittedRequest();
        $this->requestAction($this->superior, $sr['id'], 'approve')->assertOk();

        // Division asks for a revision
        $this->requestAction($this->itLead, $sr['id'], 'request-revision', [])->assertStatus(422)->assertJsonValidationErrors('notes');
        $sr = $this->requestAction($this->itLead, $sr['id'], 'request-revision', ['notes' => 'Sebutkan tipe scanner'])
            ->assertOk()->json('data');

        $this->assertSame('draft', $sr['status']);
        $this->assertSame(1, $sr['revision_no']);
        $this->assertSame('REQ0001/IT/X/2026', $sr['request_number'], 'number is kept');
        $this->assertSame([], $sr['approval_steps'], 'new round not started yet');
        $this->assertSame(['completed', 'approved', 'revision_requested', 'cancelled'], array_column($sr['approval_history'], 'status'));
        $this->assertSame([], $sr['signatures'], 'signatures of the old round are revoked');
        $this->assertSame(2, DocumentSignature::query()->whereNotNull('revoked_at')->count(), 'requester + superior signatures revoked');
        $this->actingAsUser($this->requester)->getJson("/api/v1/service-requests/{$sr['id']}")
            ->assertJsonPath('data.permissions.can_update', true)
            ->assertJsonPath('data.permissions.can_submit', true)
            ->assertJsonPath('data.permissions.can_delete', false); // a numbered request can only be cancelled
        $this->sentTo($this->requester, 'service_request.revision_requested', true);

        // Requester revises and resubmits → round 1 starts again at the superior
        $this->actingAsUser($this->requester)->putJson("/api/v1/service-requests/{$sr['id']}", $this->requestPayload([
            'purpose' => 'Perbaikan scanner Brother ADS-2200 (SN 123) di Bagian Pengadaan',
        ]))->assertOk();
        $sr = $this->requestAction($this->requester, $sr['id'], 'submit')->assertOk()->json('data');

        $this->assertSame('waiting_superior', $sr['status']);
        $this->assertSame('REQ0001/IT/X/2026', $sr['request_number']);
        $this->assertSame([1, 1, 1, 1], array_column($sr['approval_steps'], 'round'));
        $this->assertSame('pending', $this->stepStatuses($sr)['superior']);
        $this->assertCount(8, $sr['approval_history']);

        // A revision asked by the superior also goes back to draft
        $sr = $this->requestAction($this->superior, $sr['id'], 'request-revision', ['notes' => 'Lampirkan foto'])->assertOk()->json('data');
        $this->assertSame('draft', $sr['status']);
        $this->assertSame(2, $sr['revision_no']);

        $sr = $this->requestAction($this->requester, $sr['id'], 'submit')->assertOk()->json('data');
        $this->requestAction($this->superior, $sr['id'], 'approve')->assertOk();
        $this->requestAction($this->itLead, $sr['id'], 'approve')->assertOk();
        $sr = $this->requestAction($this->tech2, $sr['id'], 'complete', ['executor_notes' => 'Selesai'])->assertOk()->json('data');

        $this->assertSame('completed', $sr['status'], 'any IT staff can finish when no foreman was appointed');
        $this->assertSame(12, ApprovalStep::query()->count());
        $this->assertSame(
            ['create', 'submit', 'approve', 'request_revision', 'update', 'submit', 'request_revision', 'submit', 'approve', 'approve', 'complete'],
            array_column($sr['logs'], 'action')
        );
    }
}
