// Registration field definitions for Drivers, Forwarders and Companies.
// No backend endpoint exists for this yet — every row here is shaped exactly
// like the record the API should return. See docs/api/registration-fields.md.
//
// The seed mirrors what the profiles collect today: each `key` is the
// snake_case form of the property the existing admin API already reads or
// writes (driversApi.js, forwardersApi.js / ForwarderForms.jsx,
// companiesApi.js), so seeding the real table is a 1:1 mapping.

export const REGISTRATION_ENTITIES = [
  { value: 'driver', label: 'Driver Fields', singular: 'Driver', icon: 'user' },
  { value: 'forwarder', label: 'Forwarder Fields', singular: 'Forwarder', icon: 'building-2' },
  { value: 'company', label: 'Company Fields', singular: 'Company', icon: 'building' },
];

export const FIELD_CATEGORIES = [
  { value: 'personal', label: 'Personal Information', icon: 'user' },
  { value: 'contact', label: 'Contact Information', icon: 'phone' },
  { value: 'identity', label: 'Identity & KYC', icon: 'id-card' },
  { value: 'business', label: 'Business Information', icon: 'briefcase' },
  { value: 'services', label: 'Services & Coverage', icon: 'route' },
  { value: 'licenses', label: 'Licenses', icon: 'badge-check' },
  { value: 'documents', label: 'Documents', icon: 'file-text' },
  { value: 'emergency', label: 'Emergency Contact', icon: 'siren' },
  { value: 'other', label: 'Other', icon: 'circle-ellipsis' },
];

export const FIELD_TYPES = [
  { value: 'text', label: 'Text', icon: 'type' },
  { value: 'textarea', label: 'Textarea', icon: 'align-left' },
  { value: 'number', label: 'Number', icon: 'hash' },
  { value: 'email', label: 'Email', icon: 'mail' },
  { value: 'phone', label: 'Phone', icon: 'phone' },
  { value: 'date', label: 'Date', icon: 'calendar' },
  { value: 'select', label: 'Select', icon: 'list' },
  { value: 'multi_select', label: 'Multi Select', icon: 'list-checks' },
  { value: 'list', label: 'List', icon: 'list-plus' },
  { value: 'file', label: 'File', icon: 'paperclip' },
];

export const VALIDATION_RULES = [
  { value: 'none', label: 'No special validation' },
  { value: 'alphanumeric', label: 'Letters and numbers only' },
  { value: 'numeric', label: 'Numbers only' },
  { value: 'email', label: 'Valid email address' },
  { value: 'phone_ng', label: 'Nigerian phone number (+234)' },
  { value: 'nin', label: 'NIN — 11 digits' },
  { value: 'url', label: 'Valid web address' },
  { value: 'date_past', label: 'Date in the past' },
  { value: 'date_future', label: 'Date in the future' },
  { value: 'min_age_18', label: 'Minimum age 18' },
];

const BASE = { visible: true, editable: true, enabled: true, helpText: '', validation: 'none', options: [] };

function def(entity, order, label, key, type, category, extra = {}) {
  return {
    ...BASE,
    id: `${entity}_${key}`,
    entity,
    label,
    key,
    type,
    category,
    required: false,
    placeholder: '',
    order,
    updatedAt: '2026-10-14T09:30:00Z',
    updatedBy: 'Trukkas Admin',
    ...extra,
  };
}

// Driver: admin create (POST /admin/users/drivers) + driver profile & license.
const driverFields = [
  def('driver', 1, 'First Name', 'first_name', 'text', 'personal', { required: true, placeholder: 'Enter first name' }),
  def('driver', 2, 'Last Name', 'last_name', 'text', 'personal', { required: true, placeholder: 'Enter last name' }),
  def('driver', 3, 'Email Address', 'email', 'email', 'contact', { required: true, placeholder: 'name@example.com', validation: 'email' }),
  def('driver', 4, 'Phone Number', 'phone', 'phone', 'contact', { required: true, placeholder: '+234 800 000 0000', validation: 'phone_ng' }),
  def('driver', 5, 'Account Type', 'registration_type', 'select', 'personal', {
    required: true, options: ['Individual', 'Company'], helpText: 'Company drivers are linked to a trucking company.', editable: false,
  }),
  def('driver', 6, "Driver's License Number", 'license_number', 'text', 'licenses', {
    required: true, placeholder: "Enter driver's license number", helpText: "Enter your valid driver's license number.", validation: 'alphanumeric',
  }),
  def('driver', 7, 'License Expiry Date', 'license_expires_at', 'date', 'licenses', { required: true, validation: 'date_future' }),
  def('driver', 8, "Driver's License Document", 'license_document', 'file', 'documents', { required: true, helpText: 'A clear photo or scan of the front of the license.' }),
];

// Forwarder / Exporter: admin create + editable profile (ForwarderForms.jsx) + document slots.
const forwarderFields = [
  def('forwarder', 1, 'First Name', 'first_name', 'text', 'personal', { required: true }),
  def('forwarder', 2, 'Middle Name', 'middle_name', 'text', 'personal'),
  def('forwarder', 3, 'Last Name', 'last_name', 'text', 'personal', { required: true }),
  def('forwarder', 4, 'Date of Birth', 'date_of_birth', 'date', 'personal', { required: true, validation: 'min_age_18' }),
  def('forwarder', 5, 'Gender', 'gender', 'select', 'personal', { options: ['Male', 'Female'] }),
  def('forwarder', 6, 'Nationality', 'nationality', 'text', 'personal'),
  def('forwarder', 7, 'Languages', 'languages', 'list', 'personal', { helpText: 'One language per line.' }),
  def('forwarder', 8, 'Years of Experience', 'years_experience', 'number', 'personal', { validation: 'numeric' }),
  def('forwarder', 9, 'Email Address', 'email', 'email', 'contact', { required: true, validation: 'email', editable: false }),
  def('forwarder', 10, 'Phone Number', 'phone', 'phone', 'contact', { required: true, validation: 'phone_ng', editable: false }),
  def('forwarder', 11, 'Alternate Phone', 'alternate_phone', 'phone', 'contact', { validation: 'phone_ng' }),
  def('forwarder', 12, 'Home Address', 'address', 'textarea', 'contact'),
  def('forwarder', 13, 'National ID (NIN)', 'nin', 'text', 'identity', { validation: 'nin', editable: false }),
  def('forwarder', 14, 'Business Name', 'business_name', 'text', 'business'),
  def('forwarder', 15, 'Business Address', 'business_address', 'textarea', 'business'),
  def('forwarder', 16, 'Business Type', 'business_type', 'text', 'business'),
  def('forwarder', 17, 'CAC Number', 'cac_number', 'text', 'business', { validation: 'alphanumeric' }),
  def('forwarder', 18, 'Tax ID', 'tax_id', 'text', 'business'),
  def('forwarder', 19, 'Website', 'website', 'text', 'business', { validation: 'url' }),
  def('forwarder', 20, 'Forwarding License No.', 'forwarding_license_number', 'text', 'licenses'),
  def('forwarder', 21, 'Forwarding License Expiry', 'forwarding_license_expiry', 'date', 'licenses', { validation: 'date_future' }),
  def('forwarder', 22, 'Export License No.', 'export_license_number', 'text', 'licenses'),
  def('forwarder', 23, 'Export License Expiry', 'export_license_expiry', 'date', 'licenses', { validation: 'date_future' }),
  def('forwarder', 24, 'Services Offered', 'services_offered', 'list', 'services', { helpText: 'One service per line.' }),
  def('forwarder', 25, 'Coverage Area', 'coverage_area', 'list', 'services'),
  def('forwarder', 26, 'Preferred Cargo Types', 'preferred_cargo_types', 'list', 'services'),
  def('forwarder', 27, 'Preferred Routes', 'preferred_routes', 'list', 'services'),
  def('forwarder', 28, 'Partner Network', 'partner_network', 'list', 'services'),
  def('forwarder', 29, 'Other Information', 'other_information', 'textarea', 'other'),
  def('forwarder', 30, 'Emergency Contact Name', 'emergency_contact_name', 'text', 'emergency'),
  def('forwarder', 31, 'Emergency Contact Phone', 'emergency_contact_phone', 'phone', 'emergency', { validation: 'phone_ng' }),
  def('forwarder', 32, 'Passport Photo', 'passport_photo', 'file', 'documents'),
  def('forwarder', 33, 'Exporter Licence', 'exporter_licence', 'file', 'documents', { helpText: 'Required for exporter accounts.' }),
  def('forwarder', 34, 'Proof of Address', 'proof_of_address', 'file', 'documents'),
];

// Trucking company: admin create/edit (companyFormBody) + company profile.
const companyFields = [
  def('company', 1, 'Company Name', 'business_name', 'text', 'business', { required: true }),
  def('company', 2, 'RC Number', 'cac_number', 'text', 'business', { required: true, validation: 'alphanumeric', helpText: 'CAC registration number.' }),
  def('company', 3, 'Business Type', 'business_type', 'text', 'business'),
  def('company', 4, 'Tax Identification Number (TIN)', 'tax_id', 'text', 'business'),
  def('company', 5, 'Website', 'website', 'text', 'business', { validation: 'url' }),
  def('company', 6, 'Contact Person', 'contact_name', 'text', 'contact', { required: true }),
  def('company', 7, 'Phone Number', 'phone', 'phone', 'contact', { required: true, validation: 'phone_ng' }),
  def('company', 8, 'Email Address', 'email', 'email', 'contact', { required: true, validation: 'email' }),
  def('company', 9, 'Business Address', 'business_address', 'textarea', 'contact', { required: true }),
];

export const registrationFields = [...driverFields, ...forwarderFields, ...companyFields];
