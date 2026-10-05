<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Digital version of form FM-BOPS-10/05.
        Schema::create('work_orders', function (Blueprint $table) {
            $table->id();
            $table->string('wo_number', 50)->unique();
            $table->timestamp('issued_at');

            $table->foreignId('requester_id')->constrained('users');
            $table->foreignId('requester_org_unit_id')->nullable()->constrained('org_units')->nullOnDelete();
            $table->string('requester_org_unit_name', 150)->nullable();
            $table->string('requester_bagian_name', 150)->nullable();
            $table->string('requester_sub_bagian_name', 150)->nullable();

            $table->foreignId('executor_unit_id')->constrained();
            $table->foreignId('service_category_id')->constrained();
            $table->string('category_note', 150)->nullable();
            $table->foreignId('equipment_id')->nullable()->constrained()->nullOnDelete();
            $table->string('equipment_code', 50)->nullable();
            $table->string('equipment_name', 150)->nullable();
            $table->foreignId('location_id')->nullable()->constrained()->nullOnDelete();
            $table->string('location_note', 150)->nullable();
            $table->text('request_description');
            $table->string('priority', 10);
            $table->string('status', 20);

            $table->foreignId('received_by_id')->nullable()->constrained('users');
            $table->timestamp('received_at')->nullable();
            $table->foreignId('picked_by_id')->nullable()->constrained('users');
            $table->timestamp('picked_at')->nullable();
            $table->foreignId('completed_by_id')->nullable()->constrained('users');
            $table->timestamp('completed_at')->nullable();
            $table->text('work_done')->nullable();
            $table->foreignId('accepted_by_id')->nullable()->constrained('users');
            $table->timestamp('accepted_at')->nullable();
            $table->boolean('auto_accepted')->default(false);
            $table->timestamp('acceptance_due_at')->nullable();
            $table->decimal('total_breakdown_hours', 8, 2)->nullable();
            $table->text('remarks')->nullable();
            $table->unsignedSmallInteger('rework_count')->default(0);
            $table->string('cancel_reason')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['executor_unit_id', 'status']);
            $table->index(['requester_id', 'status']);
            $table->index('requester_org_unit_id');
            $table->index(['equipment_id', 'issued_at']);
            $table->index('issued_at');
            $table->index(['status', 'acceptance_due_at']);
        });

        Schema::create('work_order_assignees', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained();
            $table->boolean('is_lead')->default(false);
            $table->foreignId('assigned_by_id')->nullable()->constrained('users');
            $table->timestamp('assigned_at');
            $table->timestamp('unassigned_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'unassigned_at']);
        });

        Schema::create('work_order_materials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('material_id')->nullable()->constrained()->nullOnDelete();
            $table->string('material_name', 150);
            $table->decimal('quantity', 12, 2);
            $table->string('unit', 20);
            $table->timestamps();
        });

        Schema::create('work_order_labours', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('worker_name', 150);
            $table->timestamp('started_at');
            $table->timestamp('finished_at');
            $table->unsignedInteger('duration_minutes');
            $table->timestamps();
        });

        Schema::create('work_order_clearances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_order_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('item_no');
            $table->string('item_label');
            $table->string('mtc_result', 10)->nullable();
            $table->foreignId('mtc_confirmed_by_id')->nullable()->constrained('users');
            $table->timestamp('mtc_confirmed_at')->nullable();
            $table->string('user_result', 10)->nullable();
            $table->foreignId('user_confirmed_by_id')->nullable()->constrained('users');
            $table->timestamp('user_confirmed_at')->nullable();
            $table->timestamps();
            $table->unique(['work_order_id', 'item_no']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('work_order_clearances');
        Schema::dropIfExists('work_order_labours');
        Schema::dropIfExists('work_order_materials');
        Schema::dropIfExists('work_order_assignees');
        Schema::dropIfExists('work_orders');
    }
};
