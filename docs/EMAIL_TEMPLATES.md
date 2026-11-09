# BatchSave Pro — Supabase Auth Email Templates

Official logo URL used by the templates:

`https://raw.githubusercontent.com/plamensve/batchsave-pro/main/src/assets/batchsave-logo-128.png`

These templates are intended for **Supabase → Authentication → Emails**.

## Confirm signup

**Subject:** `Confirm your BatchSave Pro account`

```html
<!doctype html>
<html lang="en"><body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f7fb;padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#fff;border:1px solid #dbe5f0;border-radius:18px;overflow:hidden;">
<tr><td style="background:#0f3b82;padding:24px 30px;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
<td><img src="https://raw.githubusercontent.com/plamensve/batchsave-pro/main/src/assets/batchsave-logo-128.png" width="64" height="64" alt="BatchSave Pro" style="display:block;width:64px;height:64px;object-fit:contain;"></td>
<td style="padding-left:14px;"><div style="font-size:24px;font-weight:700;color:#fff;">BatchSave Pro</div><div style="font-size:13px;color:#bfdbfe;margin-top:3px;">Files and Gmail attachments</div></td>
</tr></table></td></tr>
<tr><td style="padding:34px 30px 28px;">
<h1 style="margin:0;font-size:26px;color:#0f172a;">Confirm your email address</h1>
<p style="margin:16px 0 0;font-size:16px;line-height:1.7;color:#475569;">Thanks for creating your <strong>BatchSave Pro</strong> account. Confirm your email address to activate your account.</p>
<div style="text-align:center;padding:28px 0 24px;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 28px;border-radius:10px;">Confirm email address</a></div>
<p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">If the button does not work, copy this link:</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;word-break:break-all;color:#2563eb;">{{ .ConfirmationURL }}</p>
<p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#64748b;">If you did not create this account, you can safely ignore this email.</p>
</td></tr>
<tr><td style="border-top:1px solid #e2e8f0;padding:20px 30px;text-align:center;font-size:12px;color:#94a3b8;">© 2026 BatchSave Pro</td></tr>
</table></td></tr></table></body></html>
```

## Reset password

**Subject:** `Reset your BatchSave Pro password`

```html
<!doctype html>
<html lang="en"><body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f7fb;padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#fff;border:1px solid #dbe5f0;border-radius:18px;overflow:hidden;">
<tr><td style="background:#0f3b82;padding:24px 30px;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
<td><img src="https://raw.githubusercontent.com/plamensve/batchsave-pro/main/src/assets/batchsave-logo-128.png" width="64" height="64" alt="BatchSave Pro" style="display:block;width:64px;height:64px;object-fit:contain;"></td>
<td style="padding-left:14px;"><div style="font-size:24px;font-weight:700;color:#fff;">BatchSave Pro</div><div style="font-size:13px;color:#bfdbfe;margin-top:3px;">Secure password recovery</div></td>
</tr></table></td></tr>
<tr><td style="padding:34px 30px 28px;">
<h1 style="margin:0;font-size:26px;color:#0f172a;">Reset your password</h1>
<p style="margin:16px 0 0;font-size:16px;line-height:1.7;color:#475569;">We received a request to reset your <strong>BatchSave Pro</strong> password.</p>
<div style="text-align:center;padding:28px 0 24px;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 28px;border-radius:10px;">Reset password</a></div>
<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:14px 16px;color:#9a3412;font-size:13px;line-height:1.6;">Only use this link if you requested the password reset.</div>
<p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#64748b;">If the button does not work, copy this link:</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;word-break:break-all;color:#2563eb;">{{ .ConfirmationURL }}</p>
<p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#64748b;">If you did not request this change, you can safely ignore this email.</p>
</td></tr>
<tr><td style="border-top:1px solid #e2e8f0;padding:20px 30px;text-align:center;font-size:12px;color:#94a3b8;">© 2026 BatchSave Pro · Account security</td></tr>
</table></td></tr></table></body></html>
```

## Invite user

**Subject:** `You’re invited to join BatchSave Pro`

```html
<!doctype html>
<html lang="en"><body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f7fb;padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#fff;border:1px solid #dbe5f0;border-radius:18px;overflow:hidden;">
<tr><td style="background:#0f3b82;padding:24px 30px;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
<td><img src="https://raw.githubusercontent.com/plamensve/batchsave-pro/main/src/assets/batchsave-logo-128.png" width="64" height="64" alt="BatchSave Pro" style="display:block;width:64px;height:64px;object-fit:contain;"></td>
<td style="padding-left:14px;"><div style="font-size:24px;font-weight:700;color:#fff;">BatchSave Pro</div><div style="font-size:13px;color:#bfdbfe;margin-top:3px;">Files and Gmail attachments</div></td>
</tr></table></td></tr>
<tr><td style="padding:34px 30px 28px;">
<h1 style="margin:0;font-size:26px;color:#0f172a;">You’re invited to BatchSave Pro</h1>
<p style="margin:16px 0 0;font-size:16px;line-height:1.7;color:#475569;">You have been invited to create a <strong>BatchSave Pro</strong> account.</p>
<div style="text-align:center;padding:28px 0 24px;"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;font-size:16px;font-weight:700;padding:14px 28px;border-radius:10px;">Accept invitation</a></div>
<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:14px 16px;color:#1e40af;font-size:13px;line-height:1.6;">Accept the invitation to finish setting up your BatchSave Pro account.</div>
<p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#64748b;">If the button does not work, copy this link:</p>
<p style="margin:8px 0 0;font-size:12px;line-height:1.6;word-break:break-all;color:#2563eb;">{{ .ConfirmationURL }}</p>
<p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#64748b;">If you were not expecting this invitation, you can safely ignore this email.</p>
</td></tr>
<tr><td style="border-top:1px solid #e2e8f0;padding:20px 30px;text-align:center;font-size:12px;color:#94a3b8;">© 2026 BatchSave Pro</td></tr>
</table></td></tr></table></body></html>
```

The Supabase template variables above use the supported `{{ .ConfirmationURL }}` value. Do not replace it with a hard-coded confirmation or recovery URL.
