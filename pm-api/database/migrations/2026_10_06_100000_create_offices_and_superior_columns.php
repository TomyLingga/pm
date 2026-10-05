<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('offices', function (Blueprint $table) {
            $table->id();
            $table->string('code', 20)->unique();
            $table->string('name', 100);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        // `superior_id` mirrors Portal `atasan_id` (overwritten on every sync);
        // `preferred_superior_id` stays the requester's own last choice.
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('superior_id')->nullable()->after('org_unit_id')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('superior_id');
        });
        Schema::dropIfExists('offices');
    }
};
