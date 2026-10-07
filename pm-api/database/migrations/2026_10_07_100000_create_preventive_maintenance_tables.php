<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Module C — Preventive Maintenance scheduler (PRD §6). */
    public function up(): void
    {
        Schema::create('checklist_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('executor_unit_id')->constrained();
            $table->string('name', 150);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('checklist_template_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('checklist_template_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->string('section', 100)->nullable();
            $table->string('description', 500);
            $table->string('input_type', 20); // ok_nok_na | number | text
            $table->string('unit', 20)->nullable();
            $table->decimal('min_value', 14, 4)->nullable();
            $table->decimal('max_value', 14, 4)->nullable();
            $table->boolean('is_required')->default(true);
            $table->boolean('photo_required')->default(false);
            $table->timestamps();
        });

        Schema::create('pm_schedules', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150);
            $table->foreignId('executor_unit_id')->constrained();
            $table->foreignId('checklist_template_id')->constrained();
            $table->string('frequency_type', 20); // hourly | daily | weekly | monthly | yearly | every_n_days
            $table->unsignedSmallInteger('frequency_interval')->default(1);
            $table->timestamp('start_at'); // first occurrence (date + time)
            $table->timestamp('end_at')->nullable();
            $table->unsignedInteger('tolerance_hours')->default(0);
            $table->unsignedInteger('due_window_hours')->nullable(); // null = config default (H-2)
            $table->unsignedInteger('estimated_minutes')->nullable();
            $table->foreignId('pic_user_id')->constrained('users');
            $table->timestamp('generated_until')->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['executor_unit_id', 'is_active']);
        });

        Schema::create('pm_schedule_equipment', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pm_schedule_id')->constrained()->cascadeOnDelete();
            $table->foreignId('equipment_id')->constrained('equipment')->cascadeOnDelete();
            $table->unique(['pm_schedule_id', 'equipment_id']);
        });

        Schema::create('pm_tasks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pm_schedule_id')->constrained();
            $table->foreignId('equipment_id')->constrained('equipment');
            $table->foreignId('executor_unit_id')->constrained();
            $table->foreignId('checklist_template_id')->constrained();
            $table->foreignId('pic_user_id')->constrained('users');
            $table->timestamp('due_at');
            $table->timestamp('due_window_at'); // becomes JATUH_TEMPO
            $table->timestamp('overdue_at');    // due_at + tolerance
            $table->string('status', 20);
            $table->timestamp('started_at')->nullable();
            $table->foreignId('started_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('completed_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedInteger('duration_minutes')->nullable();
            $table->boolean('is_late')->default(false);
            $table->text('notes')->nullable();
            $table->string('skip_reason')->nullable();
            $table->foreignId('skipped_by_id')->nullable()->constrained('users')->nullOnDelete(); // null = system
            $table->timestamp('skipped_at')->nullable();
            $table->string('skip_proposal')->nullable();
            $table->foreignId('skip_proposed_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('skip_proposed_at')->nullable();
            $table->timestamp('reminder_upcoming_sent_at')->nullable();
            $table->timestamp('reminder_due_sent_at')->nullable();
            $table->timestamp('last_overdue_reminder_at')->nullable();
            $table->timestamps();

            // Makes pm:generate-tasks idempotent.
            $table->unique(['pm_schedule_id', 'equipment_id', 'due_at']);
            $table->index(['status', 'due_window_at']);
            $table->index(['status', 'overdue_at']);
            $table->index(['pic_user_id', 'status']);
            $table->index(['executor_unit_id', 'status', 'due_at']);
            $table->index(['equipment_id', 'due_at']);
        });

        // Checklist answers; copied from the template when the task is started.
        Schema::create('pm_task_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pm_task_id')->constrained()->cascadeOnDelete();
            $table->foreignId('checklist_template_item_id')->nullable()->constrained()->nullOnDelete();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->string('section', 100)->nullable();
            $table->string('description', 500);
            $table->string('input_type', 20);
            $table->string('unit', 20)->nullable();
            $table->decimal('min_value', 14, 4)->nullable();
            $table->decimal('max_value', 14, 4)->nullable();
            $table->boolean('is_required')->default(true);
            $table->boolean('photo_required')->default(false);
            $table->string('result', 10)->nullable(); // ok | not_ok | na
            $table->decimal('value_number', 14, 4)->nullable();
            $table->text('value_text')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('pm_task_materials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pm_task_id')->constrained()->cascadeOnDelete();
            $table->foreignId('material_id')->nullable()->constrained()->nullOnDelete();
            $table->string('material_name', 150);
            $table->decimal('quantity', 12, 2);
            $table->string('unit', 20);
            $table->timestamps();
        });

        // Work Order raised from a "Tidak OK" finding.
        Schema::table('work_orders', function (Blueprint $table) {
            $table->foreignId('pm_task_id')->nullable()->after('converted_at')->constrained('pm_tasks')->nullOnDelete();
            $table->foreignId('pm_task_item_id')->nullable()->after('pm_task_id')->constrained('pm_task_items')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('pm_task_item_id');
            $table->dropConstrainedForeignId('pm_task_id');
        });
        Schema::dropIfExists('pm_task_materials');
        Schema::dropIfExists('pm_task_items');
        Schema::dropIfExists('pm_tasks');
        Schema::dropIfExists('pm_schedule_equipment');
        Schema::dropIfExists('pm_schedules');
        Schema::dropIfExists('checklist_template_items');
        Schema::dropIfExists('checklist_templates');
    }
};
