<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Program Kerja Tahunan (annual work programme per org unit → sub-items → activities with PICs)
 * and Aktivitas Harian (daily activity reports). Status changes are logged in `status_logs`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('work_programs', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('year');
            $table->string('code', 10);                       // "A"
            $table->string('title', 200);                     // "ENABLING DIGITAL AND RELIABLE OPERATION"
            $table->text('description')->nullable();
            $table->foreignId('org_unit_id')->constrained('org_units');   // owner unit (seksi / sub bagian / bagian)
            $table->string('status', 20)->default('active'); // active | closed
            $table->foreignId('created_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['year', 'org_unit_id', 'code']);
            $table->index(['year', 'org_unit_id']);
        });

        Schema::create('work_program_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_program_id')->constrained()->cascadeOnDelete();
            $table->string('code', 15);                       // "A.1"
            $table->string('title', 200);                     // "IT Development"
            $table->text('description')->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();
            $table->index(['work_program_id', 'sort_order']);
        });

        Schema::create('work_program_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_program_item_id')->constrained()->cascadeOnDelete();
            $table->unsignedSmallInteger('sequence')->default(0);
            $table->string('title', 250);                     // "Integrasi SAP dengan SmartWB"
            $table->text('action_plan')->nullable();          // "Action to be taken"
            $table->date('target_date')->nullable();
            $table->date('closed_date')->nullable();
            $table->string('status', 20)->default('open');   // open | on_progress | closed | cancelled
            $table->unsignedTinyInteger('progress_pct')->default(0);
            $table->text('remarks')->nullable();
            $table->foreignId('created_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['work_program_item_id', 'sequence']);
            $table->index('status');
        });

        Schema::create('work_program_activity_pics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('work_program_activity_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role', 12)->default('pendukung'); // utama | pendukung
            $table->timestamps();
            $table->unique(['work_program_activity_id', 'user_id']);
            $table->index('user_id');
        });

        Schema::create('daily_activities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained();                              // PIC / reporter
            $table->foreignId('org_unit_id')->nullable()->constrained('org_units')->nullOnDelete();
            $table->foreignId('work_program_activity_id')->nullable()->constrained()->nullOnDelete();
            $table->date('activity_date');                                            // "Tanggal Start"
            $table->string('title', 250);
            $table->text('description');                                              // laporan kegiatan
            $table->text('follow_up')->nullable();                                    // tindak lanjut
            $table->text('obstacles')->nullable();                                    // kendala
            $table->string('status', 20)->default('open');                           // open | on_progress | closed
            $table->timestamp('closed_at')->nullable();
            $table->foreignId('created_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['user_id', 'activity_date']);
            $table->index(['org_unit_id', 'activity_date']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_activities');
        Schema::dropIfExists('work_program_activity_pics');
        Schema::dropIfExists('work_program_activities');
        Schema::dropIfExists('work_program_items');
        Schema::dropIfExists('work_programs');
    }
};
