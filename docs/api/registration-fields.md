# Registration Fields API — proposed contract

**Status: integrated.** The admin UI at `Settings → Fields Registration`
(`/settings/fields-registration`) uses the documented admin API through
`src/store/features/settings/registrationFieldsApi.js`. The live
[Swagger specification](https://trukkas-backend.onrender.com/api/docs#/) is authoritative.

The sections below preserve the original proposed contract and seed rationale.
The implemented API also documents `expectedVersion` on field updates and a
`skipped` collection for protected fields in bulk updates. Admin reads and writes
require an authenticated admin session; writes require Super Admin. The mock API
and fixtures are retained as reference and are not used by this screen.

- UI: `src/screens/SettingsFieldsRegistration.jsx`
- Mock API (one function per endpoint below): `src/mock/registrationFieldsApi.js`
- Seed data in the exact response shape: `src/mock/fixtures/registrationFields.js`

## What this feature does

Admins control which data fields the **Driver**, **Forwarder** and **Company**
registration and profile-update forms collect: label, key, input type, whether it's
required, whether it's shown, whether the user can change it after signing up, help
text, a validation rule, and the order on the form.

The mobile/web onboarding apps should render their registration forms from
`GET /registration-fields/:entity` (public, see the last section) instead of
hard-coding them.

## Data model

### `RegistrationField`

| Field         | Type                     | Notes |
|---------------|--------------------------|-------|
| `id`          | string                   | Server-generated, stable. |
| `entity`      | `"driver" \| "forwarder" \| "company"` | Which form the field belongs to. |
| `label`       | string, 1–80 chars       | Shown to the user. |
| `key`         | string                   | `^[a-z][a-z0-9_]{1,63}$`. **Unique per entity.** The property name the submitted value is stored under. |
| `type`        | `FieldType`              | See below. |
| `category`    | `FieldCategory`          | Groups fields in the admin UI and form sections. |
| `placeholder` | string                   | Only meaningful for text-like types. |
| `helpText`    | string, ≤ 200 chars      | Shown under the input. |
| `required`    | boolean                  | Must be filled to complete registration. |
| `visible`     | boolean                  | Shown on the registration form. |
| `editable`    | boolean                  | User may change the value after registration. |
| `enabled`     | boolean                  | The **Status** toggle. A disabled field is not collected anywhere and is not returned by the public endpoint. |
| `validation`  | `ValidationRule`         | Server must enforce this on submission, not just the client. |
| `options`     | string[]                 | Required (≥ 1) when `type` is `select` or `multi_select`; empty otherwise. |
| `order`       | integer ≥ 1              | Position within the entity's form. Contiguous `1..n` per entity. |
| `updatedAt`   | ISO-8601 string          | |
| `system`      | boolean, read-only       | Set by the backend for fields the sign-up flow depends on. A system field can't be deleted, duplicated, disabled or made optional, and its `key` / `type` can't change — reject with `409`. |
| `updatedBy`   | string                   | Admin display name. |

### Enums

```
FieldType       = text | textarea | number | email | password | phone | date | select | multi_select
                | list | checkbox | file
FieldCategory   = personal | contact | identity | business | director | services | licenses
                | documents | emergency | other
ValidationRule  = none | alphanumeric | numeric | full_name | email | email_unique | password_strength
                | phone_ng | phone_ng_otp | nin | bvn | bank_account_ng | year | url
                | date_past | date_future | min_age_18 | must_accept
```

`list` is a free-text, multi-value field (one entry per line), stored as `string[]` —
e.g. the forwarder's `servicesOffered`, `coverageArea`, `languages`.

### Seed data

**Driver and Forwarder** seeds list the fields the existing admin API already
reads/writes for each profile, with `key` as the snake_case form of the current
backend property, so seeding the real table is a 1:1 mapping:

| Entity    | Fields (current backend property) |
|-----------|-----------------------------------|
| Driver    | `firstName`, `lastName`, `email`, `phone`, `registrationType`, `license.number`, `license.expiresAt`, license document |
| Forwarder | `firstName`, `middleName`, `lastName`, `dateOfBirth`, `gender`, `nationality`, `languages`, `yearsExperience`, `email`, `phone`, `alternatePhone`, `address`, `nin`, `businessName`, `businessAddress`, `businessType`, `cacNumber`, `taxId`, `website`, `forwardingLicenseNumber`/`Expiry`, `exportLicenseNumber`/`Expiry`, `servicesOffered`, `coverageArea`, `preferredCargoTypes`, `preferredRoutes`, `partnerNetwork`, `otherInformation`, `emergencyContactName`/`Phone`, documents `PASSPORT_PHOTO`, `EXPORTER_LICENCE`, `PROOF_OF_ADDRESS` |

**Company** seeds follow the company self-registration flow (36 fields, in form order):

| Step | Fields |
|------|--------|
| 1. Account holder (`personal`) | `full_name`*, `work_email`* (unique; never verified), `password`* (8+ chars, strength check, confirm must match), `terms_accepted`* (terms + privacy + authorised to register), `date_of_birth`* (18+), `mobile_number`* (Nigerian, SMS-verified) |
| 2. Company (`business`) | `company_name`*, `rc_number`*, `business_address`*, `business_type`, `year_founded`, `company_email`, `company_phone`, `state` (36 states + FCT), `fleet_size`, `operating_regions` |
| 2. Director (`director`) | `director_full_name`*, `director_date_of_birth`*, `director_role` |
| 3. Documents (`documents`) | `cac_certificate`* + `cac_certificate_rc_number`*, `cac_status_report`, `memorandum_of_association`, `tin_certificate`* + `tin`*, `director_government_id` + `_expiry`, `proof_of_business_address`, `corporate_bank_account` + `corporate_account_number` (masked), `git_insurance`* + `git_insurance_expiry`*, `haulage_permit` + `haulage_permit_expiry`, `director_nin`, `director_bvn` |

\* required. Notes for the company flow:

- **Documents step is skippable.** Required document fields are required to
  complete verification, not to create the account. The public endpoint should
  expose each field's step (derivable from `category`) so the app can let users
  skip step 3 and return to it.
- **Document extra details** (RC number, TIN, expiry dates, account number) are
  separate fields placed directly after their document.
- **Director's NIN / BVN** are listed on the form but can't be submitted yet
  (number only, no file), so they're seeded disabled.
- **System fields:** `full_name`, `work_email`, `password`, `terms_accepted`,
  `mobile_number` are `system: true`.


The UI reads these lists from `src/mock/fixtures/registrationFields.js`. If the
backend prefers to own them, add `GET /admin/settings/registration-fields/meta`
returning `{ types, categories, validationRules }` as `{ value, label }[]` and the UI
will switch to it.

## Admin endpoints

All under the existing admin base URL (`/api/v1`), bearer-authenticated, same
envelope as other admin settings endpoints (`{ data, message }`). `:entity` is one of
`driver | forwarder | company`.

### List fields

`GET /admin/settings/registration-fields/:entity`

Returns every field for the entity, sorted by `order`, including disabled and hidden
ones. The UI does search, category and filter client-side (tens of fields, not
thousands), so no query params are needed.

```json
{
  "data": {
    "entity": "driver",
    "fields": [
      {
        "id": "driver_license_number",
        "entity": "driver",
        "label": "Driver's License Number",
        "key": "license_number",
        "type": "text",
        "category": "licenses",
        "placeholder": "Enter driver's license number",
        "helpText": "Enter your valid driver's license number.",
        "required": true,
        "visible": true,
        "editable": true,
        "enabled": true,
        "validation": "alphanumeric",
        "options": [],
        "order": 6,
        "updatedAt": "2026-10-14T09:30:00Z",
        "updatedBy": "Trukkas Admin"
      }
    ]
  }
}
```

Tab counts (`Driver Fields (8)` etc.) need all three totals on first load. Either
call this endpoint once per entity, or add `GET /admin/settings/registration-fields/summary`
→ `{ driver: 8, forwarder: 34, company: 9 }`.

### Create field

`POST /admin/settings/registration-fields/:entity`

Body: every `RegistrationField` property except `id`, `entity`, `updatedAt`,
`updatedBy`. `order` is optional — omitted means append to the end; a value inserts
at that position and shifts the rest down.

Returns `201` with the created field.

### Update field

`PATCH /admin/settings/registration-fields/:entity/:fieldId`

Partial body. Used by the edit panel (any properties) and by the Status toggle in the
table (`{ "enabled": false }`). If `order` changes, the server renumbers the other
fields so the entity stays contiguous `1..n`.

Returns `200` with the updated field.

### Delete field

`DELETE /admin/settings/registration-fields/:entity/:fieldId`

Remaining fields are renumbered. **Values already stored on existing driver /
forwarder / company records must not be deleted** — the field just stops being
collected. Consider a soft delete so the key can't be silently reused for a
different meaning.

Returns `200` `{ "data": { "id": "...", "deleted": true } }`.

### Reorder

`PUT /admin/settings/registration-fields/:entity/order`

Body `{ "fieldIds": ["id1", "id2", ...] }` — the full list for the entity in its new
order. Used by drag-and-drop and Move Up / Move Down. Reject with `422` if the list
doesn't contain exactly the entity's field ids.

Returns `200` with the full, reordered field list.

### Duplicate

`POST /admin/settings/registration-fields/:entity/:fieldId/duplicate`

Creates a copy directly below the source with label `"<label> (Copy)"` and key
`<key>_copy` (or `_copy_2`, `_copy_3`… if taken). Returns `201` with the new field.
(Optional — the client can do this with a create call if you'd rather not add it.)

### Bulk update

`PATCH /admin/settings/registration-fields/:entity/bulk`

Body `{ "fieldIds": [...], "changes": { "required"?: boolean, "enabled"?: boolean } }`.
Backs the Mark Required / Mark Optional / Enable / Disable bar shown when rows are
selected. Returns `200` with the updated fields.

## Validation errors

Return `422` with per-property messages so the edit panel can show them inline:

```json
{
  "message": "Validation failed.",
  "errors": {
    "key": "Another field already uses this key.",
    "options": "Add at least one option."
  }
}
```

Rules the server must enforce (the mock implements the same in
`validateRegistrationField`):

- `label` required, ≤ 80 chars
- `key` matches `^[a-z][a-z0-9_]{1,63}$` and is unique within the entity
- `type` is a known `FieldType`
- `options` non-empty for `select` / `multi_select`
- `helpText` ≤ 200 chars
- `order` is an integer ≥ 1

## Things the backend should decide

1. **Confirm the system fields.** The UI honours `system: true` (lock icon; no
   delete/duplicate; status, required, key and type locked). Seeded as system:
   driver `first_name`, `last_name`, `email`, `phone`, `registration_type`,
   `license_number`; forwarder `first_name`, `last_name`, `date_of_birth`, `email`,
   `phone`; company `full_name`, `work_email`, `password`, `terms_accepted`,
   `mobile_number`.
2. **Changing `key` or `type` after data exists.** Either forbid it once any record
   has a value for the field, or migrate. Forbidding is simpler.
3. **Audit log.** Every create / update / delete / reorder should land in the
   existing admin audit log (`AdminAuditLogs`).
4. **Permissions.** Probably Super Admin only, consistent with other settings.
5. **Versioning.** Other settings sections use an `expectedVersion` check to avoid
   lost updates; the same would make sense here if two admins can edit at once.

## Public endpoint for the onboarding apps

`GET /registration-fields/:entity` (no admin auth)

Returns only `enabled && visible` fields, sorted by `order`, with just what a form
renderer needs: `key, label, type, category, placeholder, helpText, required,
editable, validation, options, order`. Registration and profile-update submissions
must be validated server-side against the same definitions.
