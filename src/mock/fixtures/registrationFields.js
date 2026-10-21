// Registration field definitions for Drivers, Forwarders and Companies.
// No backend endpoint exists for this yet — every row here is shaped exactly
// like the record the API should return. See docs/api/registration-fields.md.

export const REGISTRATION_ENTITIES = [
  { value: 'driver', label: 'Driver Fields', singular: 'Driver', icon: 'user' },
  { value: 'forwarder', label: 'Forwarder Fields', singular: 'Forwarder', icon: 'building-2' },
  { value: 'company', label: 'Company Fields', singular: 'Company', icon: 'building' },
];

export const FIELD_CATEGORIES = [
  { value: 'personal', label: 'Personal Information', icon: 'user' },
  { value: 'contact', label: 'Contact Information', icon: 'phone' },
  { value: 'identity', label: 'Identity & KYC', icon: 'id-card' },
  { value: 'documents', label: 'Driver Documents', icon: 'file-text' },
  { value: 'vehicle', label: 'Vehicle Information', icon: 'truck' },
  { value: 'banking', label: 'Banking Information', icon: 'landmark' },
  { value: 'business', label: 'Business Information', icon: 'briefcase' },
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
  { value: 'file', label: 'File', icon: 'paperclip' },
];

export const VALIDATION_RULES = [
  { value: 'none', label: 'No special validation' },
  { value: 'alphanumeric', label: 'Letters and numbers only' },
  { value: 'numeric', label: 'Numbers only' },
  { value: 'email', label: 'Valid email address' },
  { value: 'phone_ng', label: 'Nigerian phone number (+234)' },
  { value: 'nin', label: 'NIN — 11 digits' },
  { value: 'bank_account_ng', label: 'NUBAN account — 10 digits' },
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

const driverFields = [
  def('driver', 1, 'Full Name', 'full_name', 'text', 'personal', { required: true, placeholder: 'Enter full name' }),
  def('driver', 2, 'Phone Number', 'phone_number', 'phone', 'contact', { required: true, placeholder: '+234 800 000 0000', validation: 'phone_ng' }),
  def('driver', 3, 'Email Address', 'email', 'email', 'contact', { required: true, placeholder: 'name@example.com', validation: 'email' }),
  def('driver', 4, 'Date of Birth', 'date_of_birth', 'date', 'personal', { required: true, validation: 'min_age_18' }),
  def('driver', 5, 'NIN (National ID)', 'nin', 'text', 'identity', { required: true, placeholder: 'Enter 11-digit NIN', validation: 'nin', editable: false }),
  def('driver', 6, "Driver's License Number", 'license_number', 'text', 'identity', {
    required: true, placeholder: "Enter driver's license number", helpText: "Enter your valid driver's license number.",
  }),
  def('driver', 7, "Driver's License Expiry", 'license_expiry', 'date', 'identity', { required: true, validation: 'date_future' }),
  def('driver', 8, 'Profile Photo', 'profile_photo', 'file', 'documents', { required: true, helpText: 'A clear, front-facing photo.' }),
  def('driver', 9, 'Current Address', 'address', 'textarea', 'contact', { required: true, placeholder: 'Street, city, state' }),
  def('driver', 10, 'Emergency Contact Name', 'emergency_name', 'text', 'contact'),
  def('driver', 11, 'Emergency Contact Phone', 'emergency_phone', 'phone', 'contact', { validation: 'phone_ng' }),
  def('driver', 12, 'Bank Name', 'bank_name', 'select', 'banking', {
    required: true, options: ['Access Bank', 'GTBank', 'First Bank', 'UBA', 'Zenith Bank', 'Opay', 'Moniepoint'],
  }),
  def('driver', 13, 'Account Number', 'account_number', 'text', 'banking', { required: true, validation: 'bank_account_ng' }),
  def('driver', 14, 'Vehicle Type', 'vehicle_type', 'select', 'vehicle', {
    options: ['Flatbed', 'Container (20ft)', 'Container (40ft)', 'Tanker', 'Box Truck', 'Tipper'],
  }),
  def('driver', 15, 'Years of Experience', 'years_experience', 'number', 'vehicle', { validation: 'numeric' }),
  def('driver', 16, 'About Me', 'about_me', 'textarea', 'other', { placeholder: 'Tell forwarders about yourself' }),
  def('driver', 17, 'Preferred routes', 'preferred_routes', 'multi_select', 'vehicle', {
    options: ['Lagos – Abuja', 'Lagos – Kano', 'Port Harcourt – Aba', 'Apapa – Ikeja', 'Onne – Onitsha'],
  }),
  def('driver', 18, 'Additional Documents', 'additional_docs', 'file', 'documents'),
];

const forwarderFields = [
  def('forwarder', 1, 'Contact Person', 'contact_person', 'text', 'personal', { required: true }),
  def('forwarder', 2, 'Job Title', 'job_title', 'text', 'personal'),
  def('forwarder', 3, 'Phone Number', 'phone_number', 'phone', 'contact', { required: true, validation: 'phone_ng' }),
  def('forwarder', 4, 'Email Address', 'email', 'email', 'contact', { required: true, validation: 'email' }),
  def('forwarder', 5, 'Office Address', 'office_address', 'textarea', 'contact', { required: true }),
  def('forwarder', 6, 'Business Name', 'business_name', 'text', 'business', { required: true }),
  def('forwarder', 7, 'CAC Registration Number', 'cac_number', 'text', 'identity', { required: true, validation: 'alphanumeric', editable: false }),
  def('forwarder', 8, 'CRFFN Number', 'crffn_number', 'text', 'identity', { required: true, helpText: 'Council for the Regulation of Freight Forwarding in Nigeria registration.' }),
  def('forwarder', 9, 'Tax Identification Number', 'tin', 'text', 'identity', { required: true, validation: 'numeric' }),
  def('forwarder', 10, 'Director NIN', 'director_nin', 'text', 'identity', { validation: 'nin' }),
  def('forwarder', 11, 'Certificate of Incorporation', 'incorporation_cert', 'file', 'documents', { required: true }),
  def('forwarder', 12, 'Operating Ports', 'operating_ports', 'multi_select', 'business', { options: ['Apapa', 'Tin Can', 'Onne', 'Calabar', 'Lekki Deep Sea'] }),
  def('forwarder', 13, 'Monthly Shipment Volume', 'monthly_volume', 'select', 'business', { options: ['1–10', '11–50', '51–200', '200+'] }),
  def('forwarder', 14, 'Bank Name', 'bank_name', 'select', 'banking', { required: true, options: ['Access Bank', 'GTBank', 'First Bank', 'UBA', 'Zenith Bank'] }),
  def('forwarder', 15, 'Account Number', 'account_number', 'text', 'banking', { required: true, validation: 'bank_account_ng' }),
  def('forwarder', 16, 'Company Website', 'website', 'text', 'other', { enabled: false }),
];

const companyFields = [
  def('company', 1, 'Company Name', 'company_name', 'text', 'business', { required: true }),
  def('company', 2, 'Trading Name', 'trading_name', 'text', 'business'),
  def('company', 3, 'CAC Registration Number', 'cac_number', 'text', 'identity', { required: true, validation: 'alphanumeric', editable: false }),
  def('company', 4, 'Tax Identification Number', 'tin', 'text', 'identity', { required: true, validation: 'numeric' }),
  def('company', 5, 'Year Established', 'year_established', 'number', 'business', { validation: 'numeric' }),
  def('company', 6, 'Head Office Address', 'head_office_address', 'textarea', 'contact', { required: true }),
  def('company', 7, 'Operations Contact Name', 'ops_contact_name', 'text', 'personal', { required: true }),
  def('company', 8, 'Operations Contact Phone', 'ops_contact_phone', 'phone', 'contact', { required: true, validation: 'phone_ng' }),
  def('company', 9, 'Operations Contact Email', 'ops_contact_email', 'email', 'contact', { required: true, validation: 'email' }),
  def('company', 10, 'Director Full Name', 'director_name', 'text', 'personal', { required: true }),
  def('company', 11, 'Director NIN', 'director_nin', 'text', 'identity', { required: true, validation: 'nin' }),
  def('company', 12, 'Fleet Size', 'fleet_size', 'number', 'vehicle', { required: true, validation: 'numeric' }),
  def('company', 13, 'Truck Types Operated', 'truck_types', 'multi_select', 'vehicle', { required: true, options: ['Flatbed', 'Container (20ft)', 'Container (40ft)', 'Tanker', 'Box Truck', 'Tipper'] }),
  def('company', 14, 'Operating States', 'operating_states', 'multi_select', 'vehicle', { options: ['Lagos', 'Ogun', 'Oyo', 'FCT', 'Kano', 'Rivers', 'Anambra'] }),
  def('company', 15, 'Certificate of Incorporation', 'incorporation_cert', 'file', 'documents', { required: true }),
  def('company', 16, 'Goods-in-Transit Insurance', 'git_insurance', 'file', 'documents', { required: true }),
  def('company', 17, 'Insurance Expiry Date', 'insurance_expiry', 'date', 'documents', { required: true, validation: 'date_future' }),
  def('company', 18, 'Haulage Permit', 'haulage_permit', 'file', 'documents'),
  def('company', 19, 'Bank Name', 'bank_name', 'select', 'banking', { required: true, options: ['Access Bank', 'GTBank', 'First Bank', 'UBA', 'Zenith Bank'] }),
  def('company', 20, 'Account Number', 'account_number', 'text', 'banking', { required: true, validation: 'bank_account_ng' }),
  def('company', 21, 'Account Name', 'account_name', 'text', 'banking', { required: true }),
  def('company', 22, 'Company Logo', 'company_logo', 'file', 'other'),
];

export const registrationFields = [...driverFields, ...forwarderFields, ...companyFields];
