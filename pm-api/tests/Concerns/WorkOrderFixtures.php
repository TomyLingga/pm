<?php

namespace Tests\Concerns;

use App\Models\Equipment;
use App\Models\ExecutorUnit;
use App\Models\Location;
use App\Models\Material;
use App\Models\OrgUnit;
use App\Models\ServiceCategory;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Testing\TestResponse;
use Laravel\Sanctum\Sanctum;

/**
 * Organization used by the Work Order tests:
 *
 *   Bagian Keuangan & Pengadaan → Sub Bagian Pengadaan (requester, colleague)
 *   Bagian Teknik → Sub Bagian Sistem & IT → Seksi IT (executor "IT": lead BOM-3, tech1, tech2 BOM-4)
 *   Bagian Teknik → Seksi Maintenance (executor "MTC": mtcTech)
 */
trait WorkOrderFixtures
{
    protected OrgUnit $requesterUnit;
    protected ExecutorUnit $it;
    protected ExecutorUnit $mtc;
    protected ServiceCategory $hardware;
    protected ServiceCategory $otherCategory;
    protected ServiceCategory $mtcCategory;
    protected User $requester;
    protected User $colleague;
    protected User $superior;
    protected User $itLead;
    protected User $tech1;
    protected User $tech2;
    protected User $mtcTech;
    protected User $outsider;
    protected Location $location;
    protected Equipment $equipment;
    protected Material $material;

    protected function setUpOrganization(): void
    {
        $this->seed(RoleSeeder::class);

        $bagianKeu = OrgUnit::factory()->ofType(OrgUnit::TYPE_BAGIAN)->create(['code' => 'KEU', 'name' => 'Keuangan & Pengadaan']);
        $this->requesterUnit = OrgUnit::factory()->ofType(OrgUnit::TYPE_SUB_BAGIAN, $bagianKeu)->create(['code' => 'PGD', 'name' => 'Pengadaan']);
        $bagianTek = OrgUnit::factory()->ofType(OrgUnit::TYPE_BAGIAN)->create(['code' => 'TEK', 'name' => 'Teknik']);
        $subIt = OrgUnit::factory()->ofType(OrgUnit::TYPE_SUB_BAGIAN, $bagianTek)->create(['code' => 'SIT', 'name' => 'Sistem & IT']);
        $seksiIt = OrgUnit::factory()->ofType(OrgUnit::TYPE_SEKSI, $subIt)->create(['code' => 'IT', 'name' => 'IT']);
        $seksiMtc = OrgUnit::factory()->ofType(OrgUnit::TYPE_SEKSI, $bagianTek)->create(['code' => 'MTC', 'name' => 'Maintenance']);

        $this->it = ExecutorUnit::factory()->create(['org_unit_id' => $seksiIt->id, 'code' => 'IT', 'display_name' => 'Sistem dan IT']);
        $this->mtc = ExecutorUnit::factory()->create(['org_unit_id' => $seksiMtc->id, 'code' => 'MTC', 'display_name' => 'Maintenance']);
        $this->hardware = ServiceCategory::factory()->create(['executor_unit_id' => $this->it->id, 'name' => 'Hardware', 'sort_order' => 1]);
        $this->otherCategory = ServiceCategory::factory()->create(['executor_unit_id' => $this->it->id, 'name' => 'Lain-lain', 'requires_note' => true, 'sort_order' => 9]);
        $this->mtcCategory = ServiceCategory::factory()->create(['executor_unit_id' => $this->mtc->id, 'name' => 'Mechanical']);

        $this->superior = User::factory()->inUnit($bagianKeu)->create(['name' => 'Indra Sakti Lubis', 'grade_code' => 'BOM-1', 'grade_level' => 13]);
        $this->requester = User::factory()->inUnit($this->requesterUnit)->create([
            'name' => 'Muhammad Adib Nugraha', 'nrk' => '119090170', 'grade_code' => 'BOM-3', 'grade_level' => 8,
            'preferred_superior_id' => $this->superior->id,
        ]);
        $this->colleague = User::factory()->inUnit($this->requesterUnit)->create(['name' => 'Rekan Pengadaan']);
        $this->itLead = User::factory()->lead()->inUnit($seksiIt)->create(['name' => 'Oka Aritonang']);
        $this->tech1 = User::factory()->technician()->inUnit($seksiIt)->create(['name' => 'Tomy Lingga']);
        $this->tech2 = User::factory()->technician()->inUnit($seksiIt)->create(['name' => 'Budi Teknisi']);
        $this->mtcTech = User::factory()->technician()->inUnit($seksiMtc)->create(['name' => 'Teknisi MTC']);
        $this->outsider = User::factory()->inUnit(OrgUnit::factory()->ofType(OrgUnit::TYPE_SEKSI)->create())->create(['name' => 'Orang Luar']);

        $this->location = Location::factory()->create(['code' => 'LOC-PGD', 'name' => 'Kantor Pengadaan']);
        $this->equipment = Equipment::factory()->create([
            'code' => 'SCN-01', 'name' => 'Scanner Brother ADS-2200',
            'location_id' => $this->location->id, 'executor_unit_id' => $this->it->id,
        ]);
        $this->material = Material::factory()->create(['code' => 'MAT-LAN', 'name' => 'Kabel LAN', 'unit' => 'm']);
    }

    protected function actingAsUser(User $user): static
    {
        app('auth')->forgetGuards();
        Sanctum::actingAs($user);

        return $this;
    }

    protected function workOrderPayload(array $overrides = []): array
    {
        return array_merge([
            'executor_unit_id' => $this->it->id,
            'service_category_id' => $this->hardware->id,
            'equipment_id' => $this->equipment->id,
            'request_description' => 'Scanner sering gagal membaca dokumen.',
            'priority' => 'high',
        ], $overrides);
    }

    /** Create a WO through the API as $by (default: requester) and return its JSON data. */
    protected function createWorkOrder(array $overrides = [], ?User $by = null): array
    {
        return $this->actingAsUser($by ?? $this->requester)
            ->postJson('/api/v1/work-orders', $this->workOrderPayload($overrides))
            ->assertCreated()
            ->json('data');
    }

    protected function action(User $user, int $id, string $action, array $body = [], string $method = 'postJson'): TestResponse
    {
        return $this->actingAsUser($user)->{$method}("/api/v1/work-orders/{$id}/{$action}", $body);
    }

    protected function completionPayload(array $overrides = []): array
    {
        return array_merge([
            'work_done' => 'Roller scanner dibersihkan dan driver diperbarui.',
            'materials' => [['material_id' => $this->material->id, 'quantity' => 2]],
            'labours' => [[
                'user_id' => $this->tech1->id,
                'started_at' => now()->subHours(2)->toIso8601String(),
                'finished_at' => now()->subMinutes(30)->toIso8601String(),
            ]],
            'clearance' => [['item_no' => 1, 'result' => 'ok'], ['item_no' => 2, 'result' => 'ok']],
        ], $overrides);
    }

    protected function acceptPayload(array $overrides = []): array
    {
        return array_merge([
            'acceptance' => 'yes',
            'clearance' => [['item_no' => 1, 'result' => 'ok'], ['item_no' => 2, 'result' => 'ok']],
            'total_breakdown_hours' => 1.5,
        ], $overrides);
    }

    /** submitted → in_progress (picked by tech1) → completed. */
    protected function completedWorkOrder(array $overrides = []): array
    {
        $wo = $this->createWorkOrder($overrides);
        $this->action($this->tech1, $wo['id'], 'pick')->assertOk();

        return $this->action($this->tech1, $wo['id'], 'complete', $this->completionPayload())->assertOk()->json('data');
    }
}
