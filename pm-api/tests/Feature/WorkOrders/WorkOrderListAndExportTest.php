<?php

namespace Tests\Feature\WorkOrders;

use App\Exports\WorkOrdersExport;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\Concerns\WorkOrderFixtures;
use Tests\TestCase;

class WorkOrderListAndExportTest extends TestCase
{
    use RefreshDatabase;
    use WorkOrderFixtures;

    private array $woScanner;
    private array $woPrinter;
    private array $woMtc;
    private array $woColleague;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpOrganization();
        Notification::fake();

        $this->travelTo(Carbon::parse('2026-09-15 09:00', 'Asia/Jakarta'));
        $this->woScanner = $this->createWorkOrder(['priority' => 'low']);
        $this->travelTo(Carbon::parse('2026-10-01 09:00', 'Asia/Jakarta'));
        $this->woPrinter = $this->createWorkOrder([
            'equipment_id' => null, 'equipment_code' => 'PRN-7', 'equipment_name' => 'Printer Epson L3110',
            'request_description' => 'Printer tidak menarik kertas', 'priority' => 'high',
        ]);
        $this->woMtc = $this->createWorkOrder([
            'executor_unit_id' => $this->mtc->id, 'service_category_id' => $this->mtcCategory->id,
            'equipment_id' => null, 'request_description' => 'Pompa bocor', 'priority' => 'medium',
        ]);
        $this->woColleague = $this->createWorkOrder(['request_description' => 'Mouse rusak'], $this->colleague);
        $this->action($this->tech1, $this->woPrinter['id'], 'pick')->assertOk();
    }

    private function ids(string $query, ?User $as = null): array
    {
        $response = $this->actingAsUser($as ?? $this->requester)->getJson('/api/v1/work-orders?'.$query)->assertOk();

        return array_column($response->json('data'), 'id');
    }

    public function test_scopes(): void
    {
        $this->assertEqualsCanonicalizing(
            [$this->woScanner['id'], $this->woPrinter['id'], $this->woMtc['id']],
            $this->ids('scope=mine')
        );
        $this->assertEqualsCanonicalizing(
            [$this->woScanner['id'], $this->woPrinter['id'], $this->woMtc['id'], $this->woColleague['id']],
            $this->ids('scope=unit', $this->colleague)
        );
        // Pool = submitted WOs of my executor units (the printer WO was already picked)
        $this->assertEqualsCanonicalizing([$this->woScanner['id'], $this->woColleague['id']], $this->ids('scope=pool', $this->tech2));
        $this->assertSame([$this->woPrinter['id']], $this->ids('scope=assigned', $this->tech1));
        $this->assertSame([$this->woMtc['id']], $this->ids('scope=executor', $this->mtcTech));
        $this->assertSame([], $this->ids('scope=pool', $this->outsider));

        $this->actingAsUser($this->requester)->getJson('/api/v1/work-orders?scope=all')->assertForbidden();
        $admin = User::factory()->create();
        $admin->assignRole(User::ROLE_ADMIN);
        $this->assertCount(4, $this->ids('scope=all', $admin));
    }

    public function test_filters_search_sort_and_pagination(): void
    {
        $this->assertSame([$this->woPrinter['id']], $this->ids('scope=mine&status=in_progress'));
        $this->assertEqualsCanonicalizing([$this->woScanner['id'], $this->woMtc['id']], $this->ids('scope=mine&status=submitted,cancelled'));
        $this->assertSame([$this->woMtc['id']], $this->ids('scope=mine&priority=medium'));
        $this->assertSame([$this->woMtc['id']], $this->ids('scope=mine&executor_unit_id='.$this->mtc->id));
        $this->assertSame([$this->woScanner['id']], $this->ids('scope=mine&equipment_id='.$this->equipment->id));
        $this->assertSame([$this->woPrinter['id']], $this->ids('scope=mine&q=epson'));
        $this->assertSame([$this->woPrinter['id']], $this->ids('scope=mine&q=PRN-7'));
        $this->assertSame([$this->woScanner['id']], $this->ids('scope=mine&issued_from=2026-09-01&issued_to=2026-09-30'));
        $this->assertSame([$this->woScanner['id']], $this->ids('scope=mine&service_category_id='.$this->hardware->id.'&issued_to=2026-09-30'));

        $this->assertSame(
            [$this->woPrinter['id'], $this->woMtc['id'], $this->woScanner['id']],
            $this->ids('scope=mine&sort=-priority')
        );

        $this->actingAsUser($this->requester)->getJson('/api/v1/work-orders?scope=mine&per_page=2&page=2')
            ->assertOk()
            ->assertJsonPath('meta.total', 3)
            ->assertJsonPath('meta.last_page', 2)
            ->assertJsonCount(1, 'data')
            ->assertJsonStructure(['data' => [[
                'id', 'wo_number', 'issued_at', 'status', 'status_label', 'priority', 'priority_label',
                'executor_unit' => ['id', 'code', 'display_name'], 'service_category' => ['id', 'name'],
                'requester' => ['id', 'nrk', 'name'], 'assignees', 'location_name',
            ]], 'links', 'meta']);

        $this->actingAsUser($this->requester)->getJson('/api/v1/work-orders?scope=bogus')
            ->assertStatus(422)->assertJsonValidationErrors('scope');
    }

    public function test_export_uses_the_same_filters(): void
    {
        Excel::fake();
        $this->travelTo(Carbon::parse('2026-10-05 14:30', 'Asia/Jakarta'));

        $this->actingAsUser($this->requester)->get('/api/v1/work-orders/export?scope=mine&priority=high')->assertOk();

        Excel::assertDownloaded('work-orders-20261005-1430.xlsx', function (WorkOrdersExport $export) {
            return $export->query()->pluck('id')->all() === [$this->woPrinter['id']];
        });
    }

    public function test_export_produces_a_readable_spreadsheet(): void
    {
        $response = $this->actingAsUser($this->requester)->get('/api/v1/work-orders/export?scope=mine&sort=issued_at')->assertOk();
        $this->assertStringContainsString('.xlsx', $response->headers->get('Content-Disposition'));

        $sheet = IOFactory::load($response->getFile()->getPathname())->getActiveSheet()->toArray();

        $this->assertSame('No. WO', $sheet[0][0]);
        $this->assertSame('Durasi SLA (jam)', $sheet[0][17]);
        $this->assertCount(4, $sheet, 'heading + 3 work orders');
        $this->assertSame($this->woScanner['wo_number'], $sheet[1][0]);
        $this->assertSame('DIAJUKAN', $sheet[1][2]);
        $this->assertSame('Rendah', $sheet[1][3]);
        $this->assertSame('Muhammad Adib Nugraha', $sheet[1][6]);
        $this->assertSame('Pengadaan', $sheet[1][9]);
        $this->assertSame('Tomy Lingga', $sheet[2][14]);
    }
}
