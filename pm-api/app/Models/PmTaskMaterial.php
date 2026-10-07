<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PmTaskMaterial extends Model
{
    protected $fillable = ['material_id', 'material_name', 'quantity', 'unit'];

    protected $casts = ['quantity' => 'float'];
}
