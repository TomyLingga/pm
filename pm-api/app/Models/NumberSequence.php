<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NumberSequence extends Model
{
    protected $fillable = ['doc_type', 'scope_code', 'year', 'last_number'];
}
