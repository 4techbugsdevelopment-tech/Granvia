<p>Hi {{ $name }},</p>

<p>Your Granvia employer account has been created.</p>

<p>Email: {{ $email }}</p>
@if($temporaryPassword)
<p>Temporary password: <strong>{{ $temporaryPassword }}</strong></p>
@endif

<p><a href="{{ $loginUrl }}">Log in to Granvia</a></p>
