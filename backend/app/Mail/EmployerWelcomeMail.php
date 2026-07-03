<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class EmployerWelcomeMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $name,
        public string $email,
        public ?string $temporaryPassword = null,
    ) {}

    public function build(): self
    {
        return $this->subject('Welcome to Granvia')
            ->view('emails.employer-welcome')
            ->with([
                'name' => $this->name,
                'email' => $this->email,
                'temporaryPassword' => $this->temporaryPassword,
                'loginUrl' => rtrim(config('app.frontend_url'), '/').'/employer',
            ]);
    }
}
