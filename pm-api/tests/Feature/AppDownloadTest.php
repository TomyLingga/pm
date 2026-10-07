<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\WorkOrderFixtures;
use Tests\TestCase;

/** Tautan unduhan aplikasi mobile: semua pengguna membaca, admin mengatur. */
class AppDownloadTest extends TestCase
{
    use RefreshDatabase;
    use WorkOrderFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpOrganization();
    }

    public function test_admin_sets_the_links_and_everyone_reads_them(): void
    {
        $admin = User::factory()->create(['name' => 'Admin']);
        $admin->assignRole(User::ROLE_ADMIN);

        $this->actingAsUser($this->tech1)->getJson('/api/v1/app-downloads')->assertOk()
            ->assertJsonPath('data.android_url', null)->assertJsonPath('data.ios_url', null)
            ->assertJsonPath('permissions.can_update', false);

        $this->actingAsUser($this->tech1)->putJson('/api/v1/app-downloads', ['android_url' => 'https://drive.google.com/x'])->assertForbidden();
        $this->actingAsUser($admin)->putJson('/api/v1/app-downloads', ['android_url' => 'bukan url'])->assertStatus(422)->assertJsonValidationErrors('android_url');

        $saved = $this->actingAsUser($admin)->putJson('/api/v1/app-downloads', [
            'android_url' => 'https://drive.google.com/file/d/abc/view',
            'ios_url' => ' https://expo.dev/accounts/inl/projects/pm-app/builds/123 ',
            'android_version' => '1.2.1',
            'ios_version' => '',
            'notes' => 'Pasang ulang bila versi berubah.',
        ])->assertOk()->json();
        $this->assertSame('https://expo.dev/accounts/inl/projects/pm-app/builds/123', $saved['data']['ios_url']);
        $this->assertNull($saved['data']['ios_version']);
        $this->assertSame('Admin', $saved['data']['updated_by']['name']);
        $this->assertTrue($saved['permissions']['can_update']);

        $this->actingAsUser($this->requester)->getJson('/api/v1/app-downloads')->assertOk()
            ->assertJsonPath('data.android_url', 'https://drive.google.com/file/d/abc/view')
            ->assertJsonPath('data.android_version', '1.2.1');

        // Clearing a link
        $this->actingAsUser($admin)->putJson('/api/v1/app-downloads', ['android_url' => null, 'ios_url' => 'https://x.test/ipa'])->assertOk()
            ->assertJsonPath('data.android_url', null)->assertJsonPath('data.ios_url', 'https://x.test/ipa');
    }
}
