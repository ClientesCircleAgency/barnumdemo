import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sharedPassword = process.env.DEMO_STAFF_PASSWORD;
const emailDomain = process.env.DEMO_EMAIL_DOMAIN || 'barnun.pt';

if (!supabaseUrl || !serviceRoleKey || !sharedPassword) {
  console.error(
    'Missing env vars. Required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_STAFF_PASSWORD'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const doctorColors = [
  '#2563eb',
  '#7c3aed',
  '#dc2626',
  '#ea580c',
  '#059669',
  '#0891b2',
  '#4f46e5',
  '#db2777',
  '#65a30d',
  '#0f766e',
];

const secretaryColors = ['#ec4899', '#14b8a6'];
const adminColor = '#111827';

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function listAllUsers() {
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) throw error;

    const batch = data?.users || [];
    users.push(...batch);

    if (batch.length < 1000) {
      return users;
    }

    page += 1;
  }
}

async function getOrCreateAuthUser(email, password, displayName) {
  const users = await listAllUsers();
  const existing = users.find((user) => user.email?.toLowerCase() === email.toLowerCase());

  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
      },
    });

    if (error) throw error;
    return data.user;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
    },
  });

  if (error) throw error;
  return data.user;
}

async function setSingleRole(userId, role) {
  const { error: deleteError } = await supabase.from('user_roles').delete().eq('user_id', userId);
  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase.from('user_roles').insert({
    user_id: userId,
    role,
  });
  if (insertError) throw insertError;
}

async function upsertProfile(userId, fullName, color) {
  const payloadWithColor = {
    user_id: userId,
    full_name: fullName,
    color,
  };

  const { error } = await supabase
    .from('user_profiles')
    .upsert(payloadWithColor, { onConflict: 'user_id' });

  if (!error) return;

  if (error.code === 'PGRST204' && error.message.includes("'color' column")) {
    const { error: fallbackError } = await supabase
      .from('user_profiles')
      .upsert(
        {
          user_id: userId,
          full_name: fullName,
        },
        { onConflict: 'user_id' }
      );

    if (fallbackError) throw fallbackError;
    return;
  }

  throw error;
}

async function upsertProfessional(userId, name, specialtyId, color) {
  const { data: professional, error: fetchError } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (professional) {
    const { error: updateError } = await supabase
      .from('professionals')
      .update({
        name,
        specialty_id: specialtyId,
        color,
      })
      .eq('id', professional.id);

    if (updateError) throw updateError;

    await syncProfessionalSpecialties(professional.id, specialtyId);

    return;
  }

  const { data: created, error: insertError } = await supabase
    .from('professionals')
    .insert({
      user_id: userId,
      name,
      specialty_id: specialtyId,
      color,
    })
    .select('id')
    .single();

  if (insertError) throw insertError;

  await syncProfessionalSpecialties(created.id, specialtyId);
}

async function syncProfessionalSpecialties(professionalId, specialtyId) {
  const { error: clearSpecialtiesError } = await supabase
    .from('professional_specialties')
    .delete()
    .eq('professional_id', professionalId);

  if (clearSpecialtiesError) {
    if (clearSpecialtiesError.code === '42P01') {
      return;
    }
    throw clearSpecialtiesError;
  }

  const { error: insertSpecialtyError } = await supabase
    .from('professional_specialties')
    .insert({
      professional_id: professionalId,
      specialty_id: specialtyId,
    });

  if (insertSpecialtyError) {
    if (insertSpecialtyError.code === '42P01') {
      return;
    }
    throw insertSpecialtyError;
  }
}

async function createAdmin() {
  const email = `admin1@${emailDomain}`;
  const name = 'Admin 1';
  const user = await getOrCreateAuthUser(email, sharedPassword, name);

  await setSingleRole(user.id, 'admin');
  await upsertProfile(user.id, name, adminColor);

  console.log(`Admin ready: ${email}`);
}

async function createSecretaries() {
  for (let index = 1; index <= 2; index += 1) {
    const email = `secretaria${index}@${emailDomain}`;
    const name = `Secretaria ${index}`;
    const color = secretaryColors[(index - 1) % secretaryColors.length];
    const user = await getOrCreateAuthUser(email, sharedPassword, name);

    await setSingleRole(user.id, 'secretary');
    await upsertProfile(user.id, name, color);

    console.log(`Secretary ready: ${email}`);
  }
}

async function createDoctors() {
  const { data: specialties, error } = await supabase
    .from('specialties')
    .select('id, name')
    .order('name');

  if (error) throw error;
  if (!specialties?.length) {
    throw new Error('No specialties found. Create specialties first.');
  }

  for (const specialty of specialties) {
    const specialtySlug = slugify(specialty.name);

    for (let index = 1; index <= 5; index += 1) {
      const email = `medico${index}.${specialtySlug}@${emailDomain}`;
      const name = `Medico ${index}`;
      const color = doctorColors[(index - 1) % doctorColors.length];
      const user = await getOrCreateAuthUser(email, sharedPassword, name);

      await setSingleRole(user.id, 'doctor');
      await upsertProfile(user.id, name, color);
      await upsertProfessional(user.id, name, specialty.id, color);

      console.log(`Doctor ready: ${email} (${specialty.name})`);
    }
  }
}

async function main() {
  await createAdmin();
  await createSecretaries();
  await createDoctors();

  console.log('');
  console.log('Demo staff created successfully.');
  console.log(`Shared password: ${sharedPassword}`);
}

main().catch((error) => {
  console.error('Failed to seed demo staff.');
  console.error(error);
  process.exit(1);
});
