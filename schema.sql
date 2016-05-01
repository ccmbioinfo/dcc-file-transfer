drop table if exists users;
create table users (
  server_id varchar not null,
  user_id varchar not null,
  user_name varchar,
  user_email varchar
);


drop table if exists groups;
create table groups (
  group_id integer primary key autoincrement,
  groupname varchar not null,
  login_site varchar not null
);


drop table if exists membership;
create table membership (
  user_id integer references users(user_id),
  group_id integer references groups(group_id)
);


drop table if exists files;
create table files (
  file_id integer primary key autoincrement,
  server_id varchar not null,
  user_id varchar not null,
  auth_token varchar not null,
  identifier varchar not null unique,
  sample_name varchar not null,
  filename varchar not null,
  total_size varchar not null,
  file_type varchar not null,
  readset varchar,
  platform varchar,
  run_type varchar,
  capture_kit varchar,
  library varchar,
  reference varchar,
  upload_status varchar,
  date_upload_start varchar not null,
  date_upload_end varchar
);

drop table if exists runs;
create table runs (
  run_id varchar not null UNIQUE ,
  user_id varchar not null,
  sample_name varchar not null,
  readset varchar,
  library varchar,
  run_type varchar,
  bed varchar,
  fastq1 varchar,
  fastq2 varchar,
  bam varchar,
  status varchar
);


drop table if exists access;
create table access (
  access_id integer primary key autoincrement,
  server_id varchar not null,
  server_name varchar,
  user_id varchar not null,
  auth_token varchar not null,
  date_created varchar not null,
  date_expired varchar not null
);


drop table if exists permissions;
create table permissions (
  permission_id integer primary key autoincrement,
  run_id references runs(run_id),
  access_id references access(access_id),
  user_id references users(user_id),
  group_id references groups(group_id)
);
