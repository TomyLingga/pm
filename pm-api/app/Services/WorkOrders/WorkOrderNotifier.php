<?php

namespace App\Services\WorkOrders;

use App\Enums\Priority;
use App\Models\User;
use App\Models\WorkOrder;
use App\Notifications\WorkOrderNotification;
use App\Services\Org\ExecutorDirectory;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

/**
 * Decides who is told about which Work Order event (in-app + Expo push, alarm for urgent ones).
 */
class WorkOrderNotifier
{
    public function __construct(private ExecutorDirectory $directory)
    {
    }

    public function created(WorkOrder $workOrder): void
    {
        $workOrder->loadMissing('executorUnit', 'requester');
        $staff = $this->directory->staffQuery($workOrder->executorUnit)->where('id', '!=', $workOrder->requester_id)->get();
        $high = $workOrder->priority === Priority::High;

        $this->send($staff, $workOrder, 'work_order.created',
            ($high ? 'WO PRIORITAS TINGGI: ' : 'WO baru: ').$workOrder->wo_number,
            $workOrder->requester->name.' — '.$this->excerpt($workOrder),
            $high);
    }

    /** @param int[] $userIds */
    public function assigned(WorkOrder $workOrder, array $userIds, User $actor): void
    {
        $users = User::query()->whereIn('id', $userIds)->where('id', '!=', $actor->id)->get();

        $this->send($users, $workOrder, 'work_order.assigned',
            'Anda ditugaskan: '.$workOrder->wo_number,
            'Oleh '.$actor->name.' — '.$this->excerpt($workOrder),
            $workOrder->priority === Priority::High);
    }

    public function picked(WorkOrder $workOrder, User $technician): void
    {
        $this->toRequester($workOrder, $technician, 'work_order.picked',
            'WO diambil: '.$workOrder->wo_number,
            'Sedang dikerjakan oleh '.$technician->name.'.');
    }

    public function received(WorkOrder $workOrder, User $lead): void
    {
        $names = $workOrder->fresh('activeAssignments.user')->assigneeUsers()->pluck('name')->join(', ');

        $this->toRequester($workOrder, $lead, 'work_order.received',
            'WO diterima: '.$workOrder->wo_number,
            'Diterima '.$lead->name.', ditugaskan ke '.$names.'.');
    }

    public function completed(WorkOrder $workOrder, User $technician): void
    {
        $this->toRequester($workOrder, $technician, 'work_order.completed',
            'Pekerjaan selesai: '.$workOrder->wo_number,
            'Mohon periksa hasil pekerjaan dan konfirmasi penerimaan.');
    }

    public function rejected(WorkOrder $workOrder, User $user, string $reason): void
    {
        $this->send($this->assignees($workOrder)->where('id', '!=', $user->id), $workOrder, 'work_order.rejected',
            'Hasil DITOLAK user: '.$workOrder->wo_number,
            $user->name.': '.Str::limit($reason, 120),
            true);
    }

    public function closed(WorkOrder $workOrder): void
    {
        $this->send($this->assignees($workOrder), $workOrder, 'work_order.closed',
            'WO ditutup: '.$workOrder->wo_number,
            $workOrder->auto_accepted ? 'Diterima otomatis oleh sistem.' : 'Hasil pekerjaan diterima user.');
    }

    private function toRequester(WorkOrder $workOrder, User $actor, string $event, string $title, string $body): void
    {
        if ((int) $workOrder->requester_id === (int) $actor->id) {
            return;
        }

        $this->send(collect([$workOrder->requester()->first()])->filter(), $workOrder, $event, $title, $body);
    }

    /** @return Collection<int, User> */
    private function assignees(WorkOrder $workOrder): Collection
    {
        return $workOrder->fresh('activeAssignments.user')->assigneeUsers();
    }

    private function send(Collection $users, WorkOrder $workOrder, string $event, string $title, string $body, bool $alarm = false): void
    {
        $users = $users->filter(fn (?User $u) => $u && $u->is_active)->values();
        if ($users->isEmpty()) {
            return;
        }

        Notification::send($users, new WorkOrderNotification($event, $workOrder->id, $title, $body, $alarm));
    }

    private function excerpt(WorkOrder $workOrder): string
    {
        return Str::limit($workOrder->request_description, 100);
    }
}
