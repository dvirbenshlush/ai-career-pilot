-- Enable pgvector for semantic matching
create extension if not exists vector;

-- Resumes table
create table resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  file_name text not null,
  file_url text not null,
  parsed_text text,
  embedding vector(1536),
  created_at timestamptz default now()
);

-- Job descriptions table
create table job_descriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  company text not null,
  description text not null,
  url text,
  embedding vector(1536),
  created_at timestamptz default now()
);

-- Match results table
create table match_results (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid references resumes(id) on delete cascade not null,
  job_id uuid references job_descriptions(id) on delete cascade not null,
  score numeric(5,2) not null,
  missing_keywords text[] default '{}',
  tailored_suggestions text,
  created_at timestamptz default now()
);

-- Job opportunities (from hunter agent)
create table job_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  company text not null,
  location text not null,
  salary_range text,
  remote boolean default false,
  url text not null,
  match_score numeric(5,2) default 0,
  tags text[] default '{}',
  found_at timestamptz default now()
);

-- Application pipeline
create table applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  job_id uuid references job_opportunities(id) on delete cascade not null,
  status text check (status in ('applied','interviewing','offer','rejected')) default 'applied',
  notes text,
  updated_at timestamptz default now()
);

-- Interview sessions
create table interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  job_id uuid references job_descriptions(id) on delete cascade not null,
  questions jsonb default '[]',
  created_at timestamptz default now()
);

-- RLS Policies
alter table resumes enable row level security;
alter table job_descriptions enable row level security;
alter table match_results enable row level security;
alter table job_opportunities enable row level security;
alter table applications enable row level security;
alter table interview_sessions enable row level security;

create policy "Users own their resumes" on resumes for all using (auth.uid() = user_id);
create policy "Users own their jobs" on job_descriptions for all using (auth.uid() = user_id);
create policy "Users own their matches" on match_results for all using (
  resume_id in (select id from resumes where user_id = auth.uid())
);
create policy "Users own their opportunities" on job_opportunities for all using (auth.uid() = user_id);
create policy "Users own their applications" on applications for all using (auth.uid() = user_id);
create policy "Users own their interviews" on interview_sessions for all using (auth.uid() = user_id);
