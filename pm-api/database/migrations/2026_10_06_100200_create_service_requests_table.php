<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** Digital version of form INLHO/BSIS-ITC/F-004 (Form Request). */
    public function up(): void
    {
        Schema::create('service_requests', function (Blueprint $table) {
            $table->id();
            $table->string('request_number', 80)->nullable()->unique();
            $table->foreignId('executor_unit_id')->constrained();
            $table->foreignId('service_category_id')->nullable()->constrained();
            $table->foreignId('office_id')->nullable()->constrained();
            $table->text('purpose');
            $table->string('priority', 10);
            $table->decimal('estimated_cost', 15, 2)->nullable();
            $table->string('status', 30);
            $table->unsignedSmallInteger('revision_no')->default(0);

            $table->foreignId('requester_id')->constrained('users');
            $table->foreignId('requester_org_unit_id')->nullable()->constrained('org_units')->nullOnDelete();
            // Identity snapshot printed in "IDENTITAS KARYAWAN" (taken at submit)
            $table->string('requester_name', 150)->nullable();
            $table->string('requester_nrk', 50)->nullable();
            $table->string('requester_position', 150)->nullable();
            $table->string('requester_employment_status', 100)->nullable();
            $table->string('requester_bagian_name', 150)->nullable();
            $table->string('requester_sub_bagian_name', 150)->nullable();
            $table->string('requester_email')->nullable();
            $table->string('requester_phone', 30)->nullable();

            $table->foreignId('superior_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('superior_name', 150)->nullable();
            $table->foreignId('assigned_executor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('executor_notes')->nullable();
            $table->text('rules_snapshot')->nullable();
            $table->string('contact_footer_snapshot')->nullable();

            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamp('rejected_at')->nullable();
            $table->string('cancel_reason')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('conversion_reason')->nullable();
            $table->timestamp('converted_at')->nullable();
            $table->foreignId('source_work_order_id')->nullable()->constrained('work_orders')->nullOnDelete();
            $table->foreignId('converted_work_order_id')->nullable()->constrained('work_orders')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['executor_unit_id', 'status']);
            $table->index(['requester_id', 'status']);
            $table->index('requester_org_unit_id');
        });

        // WO ↔ Form Request conversion (Q-9)
        Schema::table('work_orders', function (Blueprint $table) {
            $table->foreignId('source_service_request_id')->nullable()->after('remarks')->constrained('service_requests')->nullOnDelete();
            $table->foreignId('converted_service_request_id')->nullable()->after('source_service_request_id')->constrained('service_requests')->nullOnDelete();
            $table->string('conversion_reason')->nullable()->after('converted_service_request_id');
            $table->timestamp('converted_at')->nullable()->after('conversion_reason');
        });
    }

    public function down(): void
    {
        Schema::table('work_orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('source_service_request_id');
            $table->dropConstrainedForeignId('converted_service_request_id');
            $table->dropColumn(['conversion_reason', 'converted_at']);
        });
        Schema::dropIfExists('service_requests');
    }
};
