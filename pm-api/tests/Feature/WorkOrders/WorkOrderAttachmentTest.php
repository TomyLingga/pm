<?php

namespace Tests\Feature\WorkOrders;

use App\Models\Attachment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\WorkOrderFixtures;
use Tests\TestCase;

class WorkOrderAttachmentTest extends TestCase
{
    use RefreshDatabase;
    use WorkOrderFixtures;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpOrganization();
        Notification::fake();
        Storage::fake('local');
    }

    private function upload(int $woId, ?UploadedFile $file = null, string $collection = 'photo_before')
    {
        return $this->postJson("/api/v1/work-orders/{$woId}/attachments", [
            'file' => $file ?? UploadedFile::fake()->image('kerusakan.jpg', 800, 600),
            'collection' => $collection,
        ]);
    }

    public function test_requester_and_technician_upload_photos_that_only_viewers_can_download(): void
    {
        $wo = $this->createWorkOrder();

        $photo = $this->actingAsUser($this->requester)->upload($wo['id'])->assertCreated()
            ->assertJsonPath('data.collection', 'photo_before')
            ->assertJsonPath('data.original_name', 'kerusakan.jpg')
            ->assertJsonPath('data.uploaded_by.id', $this->requester->id)
            ->json('data');
        $this->assertSame("/api/v1/attachments/{$photo['id']}", $photo['url']);
        Storage::disk('local')->assertExists(Attachment::query()->find($photo['id'])->path);

        $this->action($this->tech1, $wo['id'], 'pick')->assertOk();
        $this->actingAsUser($this->tech1)->upload($wo['id'], null, 'photo_after')->assertCreated();

        $this->actingAsUser($this->colleague)->get($photo['url'])->assertOk()->assertHeader('Content-Type', 'image/jpeg');
        $this->actingAsUser($this->outsider)->get($photo['url'])->assertForbidden();
        $this->actingAsUser($this->outsider)->upload($wo['id'])->assertForbidden();

        $detail = $this->actingAsUser($this->requester)->getJson("/api/v1/work-orders/{$wo['id']}")->json('data');
        $this->assertSame(['photo_before', 'photo_after'], array_column($detail['attachments'], 'collection'));
    }

    public function test_only_the_uploader_can_delete_before_closing(): void
    {
        $wo = $this->createWorkOrder();
        $photo = $this->actingAsUser($this->requester)->upload($wo['id'])->json('data');

        $this->actingAsUser($this->colleague)->deleteJson($photo['url'])->assertForbidden();
        $this->actingAsUser($this->requester)->deleteJson($photo['url'])->assertNoContent();
        $this->assertSame(0, Attachment::query()->count());
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_upload_rules(): void
    {
        $wo = $this->createWorkOrder();
        $this->actingAsUser($this->requester);

        $this->upload($wo['id'], UploadedFile::fake()->create('virus.exe', 10))->assertStatus(422)->assertJsonValidationErrors('file');
        $this->upload($wo['id'], UploadedFile::fake()->image('besar.jpg')->size(6000))->assertStatus(422)->assertJsonValidationErrors('file');
        $this->upload($wo['id'], null, 'selfie')->assertStatus(422)->assertJsonValidationErrors('collection');

        for ($i = 0; $i < 10; $i++) {
            $this->upload($wo['id'])->assertCreated();
        }
        $this->upload($wo['id'])->assertStatus(422)->assertJsonPath('errors.file.0', 'Maksimal 10 lampiran per dokumen.');
    }

    public function test_no_uploads_after_the_work_order_is_closed(): void
    {
        $wo = $this->completedWorkOrder();
        $this->action($this->requester, $wo['id'], 'accept', $this->acceptPayload())->assertOk();

        $this->actingAsUser($this->requester)->upload($wo['id'])->assertStatus(409);
    }
}
