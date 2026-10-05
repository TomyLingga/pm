<?php

namespace Tests\Concerns;

use App\Models\Office;
use App\Models\User;
use Database\Seeders\OfficeSeeder;
use Illuminate\Testing\TestResponse;

/**
 * Form Request fixtures on top of the Work Order organization:
 * requester (Pengadaan) → Atasan YBS = superior (Portal atasan_id) → IT lead (Mgr/Spv) → IT technicians (Foreman).
 */
trait ServiceRequestFixtures
{
    use WorkOrderFixtures;

    protected Office $headOffice;

    protected function setUpServiceRequests(): void
    {
        $this->setUpOrganization();
        $this->seed(OfficeSeeder::class);
        $this->headOffice = Office::query()->where('code', 'HO')->firstOrFail();

        // Superior comes from Portal atasan_id; the requester has not picked anyone yet.
        $this->requester->update(['superior_id' => $this->superior->id, 'preferred_superior_id' => null, 'phone' => '085322762975']);
        $this->superior->update(['phone' => '085761959096']);
        $this->itLead->update(['phone' => '085375913300']);
        $this->tech1->update(['phone' => '082178546887']);

        $this->it->update([
            'request_rules' => "1. Bahwa dengan pengesahan diatas, yang bersangkutan telah menerima IT Security Policy INL\n"
                ."2. Password akan diinformasikan langsung oleh administrator via Aplikasi/HP/SMS/Extention",
            'contact_footer' => 'Untuk informasi, silakan menghubungi IT HP : 081260666418 Ext. 144',
        ]);
    }

    protected function requestPayload(array $overrides = []): array
    {
        return array_merge([
            'executor_unit_id' => $this->it->id,
            'service_category_id' => $this->hardware->id,
            'office_id' => $this->headOffice->id,
            'purpose' => 'Perbaikan/Pengecekan scanner EPSON di Bagian Pengadaan. Kendala: hasil scan sering tidak terbaca',
            'priority' => 'high',
            'estimated_cost' => 1500000,
        ], $overrides);
    }

    protected function createRequest(array $overrides = [], ?User $by = null): array
    {
        return $this->actingAsUser($by ?? $this->requester)
            ->postJson('/api/v1/service-requests', $this->requestPayload($overrides))
            ->assertCreated()
            ->json('data');
    }

    protected function requestAction(User $user, int $id, string $action, array $body = []): TestResponse
    {
        return $this->actingAsUser($user)->postJson("/api/v1/service-requests/{$id}/{$action}", $body);
    }

    /** Draft created and submitted by the requester (waiting for the superior). */
    protected function submittedRequest(array $overrides = [], ?User $by = null): array
    {
        $draft = $this->createRequest($overrides, $by);

        return $this->requestAction($by ?? $this->requester, $draft['id'], 'submit')->assertOk()->json('data');
    }

    /** @return array<string, string> step key => status for the current round */
    protected function stepStatuses(array $request): array
    {
        return collect($request['approval_steps'])->mapWithKeys(fn ($s) => [$s['key'] => $s['status']])->all();
    }
}
