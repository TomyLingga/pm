<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** A completed Work Order automatically becomes a closed daily report of its technicians. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('daily_activities', function (Blueprint $table) {
            $table->foreignId('work_order_id')->nullable()->after('work_program_activity_id')->constrained()->nullOnDelete();
            $table->index(['work_order_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::table('daily_activities', function (Blueprint $table) {
            $table->dropConstrainedForeignId('work_order_id');
        });
    }
};
