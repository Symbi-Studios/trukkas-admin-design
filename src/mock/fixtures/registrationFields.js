// Registration field definitions for Drivers, Forwarders and Companies.
// No backend endpoint exists for this yet — every row here is shaped exactly
// like the record the API should return. See docs/api/registration-fields.md.
//
// The seed mirrors what the profiles collect today: each `key` is the
// snake_case form of the property the existing admin API already reads or
// writes (driversApi.js, forwardersApi.js / ForwarderForms.jsx,
// companiesApi.js), so seeding the real table is a 1:1 mapping.

export const REGISTRATION_ENTITIES = [
  { value: 'driver', label: 'Driver Fields', singular: 'Driver', plural: 'drivers', icon: 'user' },
  { value: 'forwarder', label: 'Forwarder Fields', singular: 'Forwarder', plural: 'forwarders', icon: 'building-2' },
  { value: 'company', label: 'Company Fields', singular: 'Company', plural: 'companies', icon: 'building' },
];

export const FIELD_CATEGORIES = [
  { value: 'personal', label: 'Personal Information', icon: 'user' },
  { value: 'contact', label: 'Contact Information', icon: 'phone' },
  { value: 'identity', label: 'Identity & KYC', icon: 'id-card' },
  { value: 'business', label: 'Business Information', icon: 'briefcase' },
  { value: 'director', label: 'Director Details', icon: 'user-round-check' },
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
  { value: 'password', label: 'Password', icon: 'lock' },
  { value: 'phone', label: 'Phone', icon: 'phone' },
  { value: 'date', label: 'Date', icon: 'calendar' },
  { value: 'select', label: 'Select', icon: 'list' },
  { value: 'multi_select', label: 'Multi Select', icon: 'list-checks' },
  { value: 'list', label: 'List', icon: 'list-plus' },
  { value: 'checkbox', label: 'Checkbox', icon: 'square-check' },
  { value: 'file', label: 'File', icon: 'paperclip' },
];

export const VALIDATION_RULES = [
  { value: 'none', label: 'No special validation' },
  { value: 'alphanumeric', label: 'Letters and numbers only' },
  { value: 'numeric', label: 'Numbers only' },
  { value: 'full_name', label: 'First and last name' },
  { value: 'email', label: 'Valid email address' },
  { value: 'email_unique', label: 'Unique email address' },
  { value: 'password_strength', label: 'Strong password (8+, confirmed)' },
  { value: 'phone_ng', label: 'Nigerian phone number (+234)' },
  { value: 'phone_ng_otp', label: 'Nigerian phone, SMS-verified' },
  { value: 'nin', label: 'NIN — 11 digits' },
  { value: 'bvn', label: 'BVN — 11 digits' },
  { value: 'bank_account_ng', label: 'NUBAN account — 10 digits' },
  { value: 'year', label: 'Year — 4 digits' },
  { value: 'must_accept', label: 'Must be ticked' },
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
    system: false,
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
  def('forwarder', 5, 'Gender', 'gender', 'select', 'personal', { options: ['Male', 'Female'], enabled: false }),
  def('forwarder', 6, 'Nationality', 'nationality', 'text', 'personal'),
  def('forwarder', 7, 'Languages', 'languages', 'list', 'personal', { helpText: 'One language per line.', enabled: false }),
  def('forwarder', 8, 'Years of Experience', 'years_experience', 'number', 'personal', { validation: 'numeric', enabled: false }),
  def('forwarder', 9, 'Email Address', 'email', 'email', 'contact', { required: true, validation: 'email', editable: false }),
  def('forwarder', 10, 'Phone Number', 'phone', 'phone', 'contact', { required: true, validation: 'phone_ng', editable: false }),
  def('forwarder', 11, 'Alternate Phone', 'alternate_phone', 'phone', 'contact', { validation: 'phone_ng' }),
  def('forwarder', 12, 'Home Address', 'address', 'textarea', 'contact', { enabled: false }),
  def('forwarder', 13, 'National ID (NIN)', 'nin', 'text', 'identity', { validation: 'nin', editable: false }),
  def('forwarder', 14, 'Business Name', 'business_name', 'text', 'business', { enabled: false }),
  def('forwarder', 15, 'Business Address', 'business_address', 'textarea', 'business', { enabled: false }),
  def('forwarder', 16, 'Business Type', 'business_type', 'text', 'business'),
  def('forwarder', 17, 'CAC Number', 'cac_number', 'text', 'business', { validation: 'alphanumeric', enabled: false }),
  def('forwarder', 18, 'Tax ID', 'tax_id', 'text', 'business', { enabled: false }),
  def('forwarder', 19, 'Website', 'website', 'text', 'business', { validation: 'url', enabled: false }),
  def('forwarder', 20, 'Forwarding License No.', 'forwarding_license_number', 'text', 'licenses', { enabled: false }),
  def('forwarder', 21, 'Forwarding License Expiry', 'forwarding_license_expiry', 'date', 'licenses', { validation: 'date_future', enabled: false }),
  def('forwarder', 22, 'Export License No.', 'export_license_number', 'text', 'licenses', { enabled: false }),
  def('forwarder', 23, 'Export License Expiry', 'export_license_expiry', 'date', 'licenses', { validation: 'date_future', enabled: false }),
  def('forwarder', 24, 'Services Offered', 'services_offered', 'list', 'services', { helpText: 'One service per line.', enabled: false }),
  def('forwarder', 25, 'Coverage Area', 'coverage_area', 'list', 'services', { enabled: false }),
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

// Trucking company: the self-serve company registration flow — step 1 account
// holder, step 2 company + director, step 3 documents (skippable, finish later).
const NG_STATES = ['Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta',
  'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT (Abuja)', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi',
  'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'];
const NOT_SUBMITTABLE = 'Listed on the form, but submission is not supported yet (number only, no file).';
const companyFields = [
  // 1. Personal details (account holder)
  def('company', 1, 'Full Name', 'full_name', 'text', 'personal', { required: true, system: true, validation: 'full_name', helpText: 'At least first and last name.' }),
  def('company', 2, 'Work Email', 'work_email', 'email', 'personal', { required: true, system: true, validation: 'email_unique', placeholder: 'name@company.com', helpText: 'Not verified — only the mobile number is.' }),
  def('company', 3, 'Password', 'password', 'password', 'personal', { required: true, system: true, editable: false, validation: 'password_strength', helpText: 'Entered twice; both must match.' }),
  def('company', 4, 'Terms Agreement', 'terms_accepted', 'checkbox', 'personal', {
    required: true, system: true, editable: false, validation: 'must_accept',
    helpText: 'Accepts the terms and privacy policy, and confirms they are authorised to register the company.',
  }),
  def('company', 5, 'Date of Birth', 'date_of_birth', 'date', 'personal', { required: true, validation: 'min_age_18' }),
  def('company', 6, 'Mobile Number', 'mobile_number', 'phone', 'personal', { required: true, system: true, validation: 'phone_ng_otp', placeholder: '+234 800 000 0000', helpText: 'Verified with an SMS code.' }),
  // 2. Company details
  def('company', 7, 'Registered Company Name', 'company_name', 'text', 'business', { required: true, helpText: 'As on your CAC certificate.' }),
  def('company', 8, 'RC / BN Number', 'rc_number', 'text', 'business', { required: true, validation: 'alphanumeric' }),
  def('company', 9, 'Business Address', 'business_address', 'textarea', 'business', { required: true, placeholder: 'Street, area, city' }),
  def('company', 10, 'Business Type', 'business_type', 'select', 'business', {
    options: ['Limited Liability Company', 'Business Name (Enterprise)', 'Partnership', 'Cooperative'],
  }),
  def('company', 11, 'Year Founded', 'year_founded', 'number', 'business', { validation: 'year', placeholder: 'YYYY' }),
  def('company', 12, 'Company Email', 'company_email', 'email', 'business', { validation: 'email' }),
  def('company', 13, 'Company Phone', 'company_phone', 'phone', 'business', { validation: 'phone_ng' }),
  def('company', 14, 'State', 'state', 'select', 'business', { options: NG_STATES }),
  def('company', 15, 'Fleet Size', 'fleet_size', 'select', 'business', { options: ['1–5 trucks', '6–20 trucks', '21–50 trucks', '51–100 trucks', '100+ trucks'] }),
  def('company', 16, 'Operating Regions', 'operating_regions', 'multi_select', 'business', {
    options: ['South West', 'South South', 'South East', 'North Central', 'North West', 'North East', 'Cross-border (ECOWAS)'],
  }),
  // 2b. Director details
  def('company', 17, "Director's Full Name", 'director_full_name', 'text', 'director', { required: true, validation: 'full_name', helpText: 'As on their government ID.' }),
  def('company', 18, "Director's Date of Birth", 'director_date_of_birth', 'date', 'director', { required: true, validation: 'date_past' }),
  def('company', 19, "Director's Role", 'director_role', 'select', 'director', { options: ['Director', 'Managing Director', 'CEO / Founder', 'Executive Director'] }),
  // 3. Company documents — each document's extra detail follows it
  def('company', 20, 'CAC Certificate of Incorporation', 'cac_certificate', 'file', 'documents', { required: true }),
  def('company', 21, 'CAC Certificate — RC Number', 'cac_certificate_rc_number', 'text', 'documents', { required: true, validation: 'alphanumeric' }),
  def('company', 22, 'CAC Status Report', 'cac_status_report', 'file', 'documents', { helpText: 'Directors & shareholders.' }),
  def('company', 23, 'Memorandum of Association', 'memorandum_of_association', 'file', 'documents'),
  def('company', 24, 'TIN Certificate', 'tin_certificate', 'file', 'documents', { required: true }),
  def('company', 25, 'TIN Certificate — TIN', 'tin', 'text', 'documents', { required: true, validation: 'numeric' }),
  def('company', 26, "Director's Government ID", 'director_government_id', 'file', 'documents', { helpText: "Passport, driver's licence or voter's card." }),
  def('company', 27, "Director's Government ID — Expiry Date", 'director_government_id_expiry', 'date', 'documents', { validation: 'date_future' }),
  def('company', 28, 'Proof of Business Address', 'proof_of_business_address', 'file', 'documents', { helpText: 'Utility bill or tenancy agreement, dated within the last 3 months.' }),
  def('company', 29, 'Corporate Bank Account', 'corporate_bank_account', 'file', 'documents', { helpText: 'Bank reference or account confirmation letter.' }),
  def('company', 30, 'Corporate Bank Account — Account Number', 'corporate_account_number', 'text', 'documents', { validation: 'bank_account_ng', helpText: 'Stored and displayed masked.' }),
  def('company', 31, 'Goods-in-Transit Insurance', 'git_insurance', 'file', 'documents', { required: true }),
  def('company', 32, 'Goods-in-Transit Insurance — Expiry Date', 'git_insurance_expiry', 'date', 'documents', { required: true, validation: 'date_future' }),
  def('company', 33, 'Haulage / Transport Operator Permit', 'haulage_permit', 'file', 'documents'),
  def('company', 34, 'Haulage Permit — Expiry Date', 'haulage_permit_expiry', 'date', 'documents', { validation: 'date_future' }),
  def('company', 35, "Director's NIN", 'director_nin', 'text', 'documents', { validation: 'nin', enabled: false, helpText: NOT_SUBMITTABLE }),
  def('company', 36, "Director's BVN", 'director_bvn', 'text', 'documents', { validation: 'bvn', enabled: false, helpText: NOT_SUBMITTABLE }),
];

export const registrationFields = [...driverFields, ...forwarderFields, ...companyFields];
