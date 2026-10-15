import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createSuperAdmin() {
  const email = 'superadmin@faafuschool.edu.mv';
  const password = 'FaafuAdmin2024!';
  const userId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: 'System Administrator',
        role: 'super_admin'
      }
    });

    if (error) {
      console.log('Note: User might already exist or using anon key (expected)');
      console.log('Error:', error.message);

      console.log('\n✓ Attempting regular signup instead...\n');

      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: email,
        password: password,
      });

      if (signupError) {
        console.error('Signup error:', signupError.message);
      } else if (signupData.user) {
        console.log('✓ User account created via signup!');
        console.log('User ID:', signupData.user.id);

        const { error: updateError } = await supabase
          .from('user_roles')
          .update({ id: signupData.user.id })
          .eq('email', email);

        if (!updateError) {
          console.log('✓ User role updated successfully!');
        }
      }
    } else if (data.user) {
      console.log('✓ Super admin user created successfully!');
      console.log('User ID:', data.user.id);
    }

    console.log('\n========================');
    console.log('SUPER ADMIN CREDENTIALS');
    console.log('========================');
    console.log('Email:', email);
    console.log('Password:', password);
    console.log('========================\n');
    console.log('You can now login with these credentials!');

  } catch (err) {
    console.error('Unexpected error:', err.message);
  }
}

createSuperAdmin();
