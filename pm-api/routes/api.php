<?php

use App\Http\Controllers\Api\V1\ApprovalController;
use App\Http\Controllers\Api\V1\AttachmentController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\LookupController;
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
        Route::get('locations', [LookupController::class, 'locations']);
        Route::get('equipment', [LookupController::class, 'equipment']);
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
        Route::post('notifications/read-all', [NotificationController::class, 'readAll']);
        Route::post('notifications/{id}/read', [NotificationController::class, 'read']);
        Route::post('push-subscriptions', [NotificationController::class, 'subscribe']);
        Route::delete('push-subscriptions', [NotificationController::class, 'unsubscribe']);
    });
});
