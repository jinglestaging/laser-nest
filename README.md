# Foundry Backend

## Setup

### Prerequisites

- Node.js 18+
- pnpm
- Supabase project

### Installation

```bash
pnpm install
```

### Environment Variables

Create a `.env` file with the following variables:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OAuth Configuration (configure these in Supabase Dashboard)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Email Configuration (handled by Supabase)
# Note: Email templates and sending are now handled by Supabase Auth

# Other Configuration
NODE_ENV=development
PORT=5004
CORS_ORIGIN=http://localhost:3000
FRONTEND_URL=http://localhost:3000
```

### Supabase Setup

1. Create a new Supabase project at https://supabase.com
2. Run the SQL migration from `supabase/migrations/20241221000000_create_users_table.sql` in your Supabase SQL editor
3. Configure Authentication settings:
   - Go to Authentication > Settings and configure your site URL
   - Enable email confirmations and password recovery if needed
   - Configure OAuth providers in Authentication > Providers (Google, GitHub)
4. Copy the project URL and keys from Settings > API

### Database Structure

The application uses Supabase's built-in authentication with a custom profiles table:

- **`auth.users`**: Managed by Supabase (contains email, password, auth metadata)
- **`public.profiles`**: Custom table linked to `auth.users.id` containing:
  - `name`: User's full name
  - `phone`: Phone number (optional)
  - `avatar`: Profile picture URL
  - `role`: User role (USER/ADMIN)

### Authentication Flow

The application uses Supabase Auth exclusively:

- **Frontend**: Handles all authentication using Supabase client:
  - Email/password login and registration
  - Password reset and email verification
  - OAuth with Google and GitHub
  - JWT token management
- **Backend**: Validates Supabase JWTs for protected routes and manages profile data
- **OAuth**: Handled entirely by Supabase's built-in OAuth providers (no custom backend code needed)

### Migration Notes

- User authentication data is now managed by Supabase's `auth.users` table
- Additional user profile information is stored in the `public.profiles` table
- The backend no longer handles JWT creation or user registration directly
- OAuth is configured and handled entirely through Supabase

### Development

```bash
pnpm start:dev
```

### Commands

```bash
# Generate module
nest g module <name>

# Generate service
nest g service <name>

# Generate controller
nest g controller <name>
```