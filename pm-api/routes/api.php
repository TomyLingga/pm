<?php

use App\Http\Controllers\Api\V1\ApprovalController;
use App\Http\Controllers\Api\V1\AttachmentController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\ChecklistTemplateController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\DailyActivityController;
use App\Http\Controllers\Api\V1\ServiceCategoryController;
use App\Http\Controllers\Api\V1\UserAccessController;
use App\Http\Controllers\Api\V1\WorkProgramController;
use App\Http\Controllers\Api\V1\EquipmentController;
use App\Http\Controllers\Api\V1\LookupController;
use App\Http\Controllers\Api\V1\PmScheduleController;
use App\Http\Controllers\Api\V1\PmTaskController;
use App\Http\Controllers\Api\V1\NotificationController;
use App\Http\Controllers\Api\V1\PublicSignatureController;
use App\Http\Controllers\Api\V1\ServiceRequestActionController;
use App\Http\Controllers\Api\V1\ServiceRequestController;
use App\Http\Controllers\Api\V1\WorkOrderActionController;
use App\Http\Controllers\Api\V1\WorkOrderController;
use Illuminate\Support\Facades\Route;

/*
| PM-App API v1 — see docs/API_WORK_ORDER.md for the contract.
*/

Route::prefix('v1')->group(function () {
    // Public
    Route::post('auth/sso', [AuthController::class, 'sso'])->middleware('throttle:30,1');
    Route::post('auth/mobile/login', [AuthController::class, 'mobileLogin'])->middleware('throttle:mobile-login');
    Route::post('auth/mobile/totp', [AuthController::class, 'mobileTotp'])->middleware('throttle:mobile-login');
    Route::get('public/signatures/{token}', [PublicSignatureController::class, 'show'])->middleware('throttle:60,1');

    Route::middleware(['auth:sanctum', 'active'])->group(function () {
        Route::post('auth/logout', [AuthController::class, 'logout']);
        Route::get('auth/me', [AuthController::class, 'me']);

        // Lookups for forms
        Route::get('executor-units', [LookupController::class, 'executorUnits']);
        Route::get('executor-units/{executorUnit}/staff', [LookupController::class, 'staff']);
        Route::get('service-categories/sections', [ServiceCategoryController::class, 'sections']);
        Route::post('service-categories', [ServiceCategoryController::class, 'store']);
        Route::put('service-categories/{serviceCategory}', [ServiceCategoryController::class, 'update']);
        Route::get('locations', [LookupController::class, 'locations']);
        Route::post('locations', [LookupController::class, 'storeLocation']);

        // Equipment master + maintenance history
        Route::get('equipment', [EquipmentController::class, 'index']);
        Route::post('equipment', [EquipmentController::class, 'store']);
        Route::get('equipment/import-template', [EquipmentController::class, 'importTemplate']);
        Route::post('equipment/import', [EquipmentController::class, 'import']);
        Route::get('equipment/{equipment}', [EquipmentController::class, 'show']);
        Route::put('equipment/{equipment}', [EquipmentController::class, 'update']);
        Route::delete('equipment/{equipment}', [EquipmentController::class, 'destroy']);
        Route::get('equipment/{equipment}/history', [EquipmentController::class, 'history']);

        // Preventive Maintenance (Module C)
        Route::get('checklist-templates', [ChecklistTemplateController::class, 'index']);
        Route::post('checklist-templates', [ChecklistTemplateController::class, 'store']);
        Route::get('checklist-templates/{checklistTemplate}', [ChecklistTemplateController::class, 'show']);
        Route::put('checklist-templates/{checklistTemplate}', [ChecklistTemplateController::class, 'update']);
        Route::delete('checklist-templates/{checklistTemplate}', [ChecklistTemplateController::class, 'destroy']);
        Route::post('checklist-templates/{checklistTemplate}/duplicate', [ChecklistTemplateController::class, 'duplicate']);

        Route::post('pm-schedules/preview', [PmScheduleController::class, 'preview']);
        Route::get('pm-schedules', [PmScheduleController::class, 'index']);
        Route::post('pm-schedules', [PmScheduleController::class, 'store']);
        Route::get('pm-schedules/{pmSchedule}', [PmScheduleController::class, 'show']);
        Route::put('pm-schedules/{pmSchedule}', [PmScheduleController::class, 'update']);
        Route::delete('pm-schedules/{pmSchedule}', [PmScheduleController::class, 'destroy']);

        Route::get('pm-tasks/summary', [PmTaskController::class, 'summary']);
        Route::get('pm-tasks/calendar', [PmTaskController::class, 'calendar']);
        Route::get('pm-tasks/export', [PmTaskController::class, 'export']);
        Route::get('pm-tasks', [PmTaskController::class, 'index']);
        Route::get('pm-tasks/{pmTask}', [PmTaskController::class, 'show']);
        Route::name('pm-tasks.')->prefix('pm-tasks/{pmTask}')->group(function () {
            Route::post('start', [PmTaskController::class, 'start'])->name('start');
            Route::put('items', [PmTaskController::class, 'items'])->name('items');
            Route::put('materials', [PmTaskController::class, 'materials'])->name('materials');
            Route::post('complete', [PmTaskController::class, 'complete'])->name('complete');
            Route::post('propose-skip', [PmTaskController::class, 'proposeSkip'])->name('propose-skip');
            Route::post('skip', [PmTaskController::class, 'skip'])->name('skip');
            Route::post('reassign', [PmTaskController::class, 'reassign'])->name('reassign');
            Route::post('attachments', [PmTaskController::class, 'attach'])->name('attachments');
            Route::post('items/{item}/work-order', [PmTaskController::class, 'findingWorkOrder'])->name('finding-work-order');
        });
        Route::get('materials', [LookupController::class, 'materials']);

        // Work orders
        Route::get('work-orders/export', [WorkOrderController::class, 'export']);
        Route::get('work-orders', [WorkOrderController::class, 'index']);
        Route::post('work-orders', [WorkOrderController::class, 'store']);
        Route::get('work-orders/{workOrder}', [WorkOrderController::class, 'show']);
        Route::put('work-orders/{workOrder}', [WorkOrderController::class, 'update']);
        Route::get('work-orders/{workOrder}/pdf', [WorkOrderController::class, 'pdf']);

        Route::post('work-orders/{workOrder}/cancel', [WorkOrderActionController::class, 'cancel']);
        Route::post('work-orders/{workOrder}/pick', [WorkOrderActionController::class, 'pick']);
        Route::post('work-orders/{workOrder}/receive', [WorkOrderActionController::class, 'receive']);
        Route::put('work-orders/{workOrder}/assignees', [WorkOrderActionController::class, 'assignees']);
        Route::post('work-orders/{workOrder}/start', [WorkOrderActionController::class, 'start']);
        Route::put('work-orders/{workOrder}/materials', [WorkOrderActionController::class, 'materials']);
        Route::put('work-orders/{workOrder}/labours', [WorkOrderActionController::class, 'labours']);
        Route::post('work-orders/{workOrder}/complete', [WorkOrderActionController::class, 'complete']);
        Route::post('work-orders/{workOrder}/accept', [WorkOrderActionController::class, 'accept']);

        Route::post('work-orders/{workOrder}/convert-to-request', [WorkOrderActionController::class, 'convertToRequest']);

        // Form Request (Module B)
        Route::get('offices', [LookupController::class, 'offices']);
        Route::get('users', [UserAccessController::class, 'index']);
        Route::put('users/{user}/access', [UserAccessController::class, 'update']);
        Route::get('users/superior-candidates', [LookupController::class, 'superiorCandidates']);
        Route::get('users/my-superior', [LookupController::class, 'mySuperior']);
        Route::put('executor-units/{executorUnit}/request-settings', [LookupController::class, 'updateRequestSettings']);

        Route::get('service-requests/export', [ServiceRequestController::class, 'export']);
        Route::get('service-requests', [ServiceRequestController::class, 'index']);
        Route::post('service-requests', [ServiceRequestController::class, 'store']);
        Route::get('service-requests/{serviceRequest}', [ServiceRequestController::class, 'show']);
        Route::put('service-requests/{serviceRequest}', [ServiceRequestController::class, 'update']);
        Route::delete('service-requests/{serviceRequest}', [ServiceRequestController::class, 'destroy']);
        Route::get('service-requests/{serviceRequest}/pdf', [ServiceRequestController::class, 'pdf']);

        Route::name('service-requests.')->prefix('service-requests/{serviceRequest}')->group(function () {
            Route::post('submit', [ServiceRequestActionController::class, 'submit'])->name('submit');
            Route::post('change-superior', [ServiceRequestActionController::class, 'changeSuperior'])->name('change-superior');
            Route::post('approve', [ServiceRequestActionController::class, 'approve'])->name('approve');
            Route::post('reject', [ServiceRequestActionController::class, 'reject'])->name('reject');
            Route::post('request-revision', [ServiceRequestActionController::class, 'requestRevision'])->name('request-revision');
            Route::post('complete', [ServiceRequestActionController::class, 'complete'])->name('complete');
            Route::post('cancel', [ServiceRequestActionController::class, 'cancel'])->name('cancel');
            Route::post('convert-to-work-order', [ServiceRequestActionController::class, 'convertToWorkOrder'])->name('convert');
            Route::post('attachments', [AttachmentController::class, 'storeForRequest'])->name('attachments');
        });

        Route::get('approvals/pending', [ApprovalController::class, 'pending']);
        Route::get('approvals/pending-count', [ApprovalController::class, 'pendingCount']);

        Route::post('work-orders/{workOrder}/attachments', [AttachmentController::class, 'store']);
        Route::get('attachments/{attachment}', [AttachmentController::class, 'show']);
        Route::delete('attachments/{attachment}', [AttachmentController::class, 'destroy']);

        // Notifications & push
        Route::get('notifications', [NotificationController::class, 'index']);
        Route::get('notifications/unread-count', [NotificationController::class, 'unreadCount']);
        Route::get('notifications/preferences', [NotificationController::class, 'preferences']);
        Route::put('notifications/preferences', [NotificationController::class, 'updatePreferences']);
        Route::get('dashboard', [DashboardController::class, 'show']);
        Route::get('dashboard/live', [DashboardController::class, 'live']);

        // Program Kerja Tahunan
        Route::get('work-programs/units', [WorkProgramController::class, 'units']);
        Route::get('work-programs/people', [WorkProgramController::class, 'people']);
        Route::get('work-programs', [WorkProgramController::class, 'index']);
        Route::post('work-programs', [WorkProgramController::class, 'store']);
        Route::get('work-programs/{workProgram}', [WorkProgramController::class, 'show']);
        Route::put('work-programs/{workProgram}', [WorkProgramController::class, 'update']);
        Route::delete('work-programs/{workProgram}', [WorkProgramController::class, 'destroy']);
        Route::get('work-programs/{workProgram}/export', [WorkProgramController::class, 'export']);
        Route::post('work-programs/{workProgram}/items', [WorkProgramController::class, 'storeItem']);
        Route::put('work-program-items/{workProgramItem}', [WorkProgramController::class, 'updateItem']);
        Route::delete('work-program-items/{workProgramItem}', [WorkProgramController::class, 'destroyItem']);
        Route::post('work-program-items/{workProgramItem}/activities', [WorkProgramController::class, 'storeActivity']);
        Route::get('work-program-activities/{workProgramActivity}', [WorkProgramController::class, 'showActivity']);
        Route::put('work-program-activities/{workProgramActivity}', [WorkProgramController::class, 'updateActivity']);
        Route::post('work-program-activities/{workProgramActivity}/status', [WorkProgramController::class, 'setActivityStatus']);
        Route::delete('work-program-activities/{workProgramActivity}', [WorkProgramController::class, 'destroyActivity']);

        // Aktivitas Harian
        Route::get('daily-activities/export', [DailyActivityController::class, 'export']);
        Route::get('daily-activities/people', [DailyActivityController::class, 'people']);
        Route::get('daily-activities/import-template', [DailyActivityController::class, 'importTemplate']);
        Route::post('daily-activities/import', [DailyActivityController::class, 'import']);
        Route::get('daily-activities', [DailyActivityController::class, 'index']);
        Route::post('daily-activities', [DailyActivityController::class, 'store']);
        Route::get('daily-activities/{dailyActivity}', [DailyActivityController::class, 'show']);
        Route::put('daily-activities/{dailyActivity}', [DailyActivityController::class, 'update']);
        Route::post('daily-activities/{dailyActivity}/status', [DailyActivityController::class, 'setStatus']);
        Route::delete('daily-activities/{dailyActivity}', [DailyActivityController::class, 'destroy']);
        Route::post('notifications/read-all', [NotificationController::class, 'readAll']);
        Route::post('notifications/{id}/read', [NotificationController::class, 'read']);
        Route::post('push-subscriptions', [NotificationController::class, 'subscribe']);
        Route::delete('push-subscriptions', [NotificationController::class, 'unsubscribe']);
    });
});
