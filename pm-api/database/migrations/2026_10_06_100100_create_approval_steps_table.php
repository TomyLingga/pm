<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Generic, reusable approval chain: one row per step per round (a round restarts after "minta revisi").
     */
    public function up(): void
    {
        Schema::create('approval_steps', function (Blueprint $table) {
            $table->id();
            $table->morphs('approvable');
            $table->unsignedSmallInteger('round')->default(0);
            $table->unsignedTinyInteger('step_order');
            $table->string('step_key', 40);
            $table->string('step_label', 80);
            $table->string('kind', 20); // submission | approval | completion
            $table->string('assignee_type', 20); // user | executor_lead | executor_staff
            $table->foreignId('assignee_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('executor_unit_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('initiator_id')->constrained('users'); // never allowed to act on its own document
            $table->string('status', 30);
            $table->timestamp('activated_at')->nullable();
            $table->foreignId('acted_by_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('acted_at')->nullable();
            $table->text('notes')->nullable();
            $table->string('actor_name', 150)->nullable();
            $table->string('actor_nrk', 50)->nullable();
            $table->string('actor_position', 150)->nullable();
            $table->string('actor_phone', 30)->nullable();
            $table->timestamp('last_reminded_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'assignee_type']);
            $table->index(['approvable_type', 'approvable_id', 'round']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('approval_steps');
    }
};
