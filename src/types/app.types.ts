export type UserRole = 'super_admin' | 'company_admin' | 'centralist' | 'planner' | 'runner';
export type LogPriority = 'info' | 'low' | 'mid' | 'high';
export type LogStatus = 'open' | 'closed';
export type EnforcementType = 'ejection' | 'arrest' | 'refusal' | 'ban';
export type AreaStatus = 'open' | 'regulated' | 'closed';
export type PositionStatus = 'normal' | 'portocheck_done' | 'sanitary_break';

export interface Company {
  id: string;
  name: string;
  slug: string;
  admin_name: string | null;
  admin_email: string | null;
  address: string | null;
  kvk_number: string | null;
  btw_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  language: string | null;
  created_at: string;
  updated_at: string;
}

export interface CompanyMember {
  id: string;
  company_id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
  profile?: Profile;
}

export interface CalibrationPoint {
  imageX: number
  imageY: number
  lat: number
  lng: number
  label?: string
}

export interface Project {
  id: string;
  company_id: string;
  name: string;
  location_name: string | null;
  location_address: string | null;
  start_date: string | null;
  end_date: string | null;
  project_leader: string | null;
  invoice_details: Record<string, unknown>;
  is_active: boolean;
  active_modules: string[];
  map_background_url: string | null;
  map_calibration: CalibrationPoint[] | null;
  map_share_token: string | null;
  created_at: string;
  updated_at: string;
}

export type DisplayMode = 'dynamic' | 'fixed' | 'cp_org';

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: UserRole;
  custom_display_name: string | null;
  standby_teams: boolean;
  fixed_positions: boolean;
  display_mode: DisplayMode;
  created_at: string;
  profile?: Profile;
}

export interface Subject {
  id: string;
  project_id: string;
  name: string;
  color: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface MapPoint {
  x: number;
  y: number;
}

export interface Area {
  id: string;
  project_id: string;
  name: string;
  status: AreaStatus;
  sort_order: number;
  map_polygon: MapPoint[] | null;
  created_at: string;
  updated_at: string;
}

export type PoiType = 'entrance' | 'exit' | 'medical' | 'stage' | 'bar' | 'toilet' | 'cp' | 'parking' | 'other'

export interface MapPoiCategory {
  id: string;
  project_id: string;
  name: string;
  color: string;
  display_style: 'dot' | 'numbered' | 'text';
  sort_order: number;
  created_at: string;
}

export interface MapPoi {
  id: string;
  project_id: string;
  label: string;
  type: PoiType;
  category_id: string | null;
  note: string | null;
  x: number;
  y: number;
  created_at: string;
}

export interface Team {
  id: string;
  project_id: string;
  number: number;
  member_names: string[];
  area_id: string | null;
  is_active: boolean;
  is_standby: boolean;
  created_at: string;
  updated_at: string;
  area?: Area;
}

export interface Position {
  id: string;
  project_id: string;
  number: number;
  name: string | null;
  area_id: string | null;
  status: PositionStatus;
  assigned_to: string | null;
  map_point: MapPoint | null;
  updated_at: string;
  area?: Area;
  assignee?: Profile;
}

export interface LogFollowup {
  id: string;
  log_id: string;
  content: string;
  created_by: string;
  display_name_snapshot: string;
  created_at: string;
  creator?: Profile;
}

export interface Log {
  id: string;
  project_id: string;
  log_number: number | null;
  incident_text: string;
  subject_id: string | null;
  priority: LogPriority;
  status: LogStatus;
  area_id: string | null;
  team_ids: string[]
  tagged_user_ids: string[];
  position_id: string | null;
  assigned_user_id: string | null;
  logged_by: string;
  display_name_snapshot: string;
  enforcement_type: EnforcementType | null;
  enforcement_reason: string | null;
  image_urls: string[];
  created_at: string;
  updated_at: string;
  subject?: Subject;
  area?: Area;
  position?: Position;
  assigned_user?: Profile;
  logger?: Profile;
  followups?: LogFollowup[];
}

export interface EnforcementCounters {
  id: string;
  project_id: string;
  subject_id: string | null;
  shift_date: string;
  ejections: number;
  arrests: number;
  refusals: number;
  bans: number;
  updated_at: string;
  subject?: Subject;
}

export interface ProjectDocument {
  id: string;
  project_id: string;
  name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
  uploader?: Profile;
}

export interface Invitation {
  id: string;
  company_id: string;
  project_id: string | null;
  email: string;
  role: UserRole;
  token: string;
  invited_by: string | null;
  accepted_at: string | null;
  expires_at: string;
  created_at: string;
}

// Simplified member for dropdowns — uses screen name when available
export interface MemberOption {
  id: string
  display_name: string
}

// UI filter state for the log feed
export interface LogFilters {
  myLogs?: boolean;
  assignedToMe?: boolean;
  infoOnly?: boolean;
  subjectId?: string;
  hasPhotos?: boolean;
  openOnly?: boolean;
  priority?: LogPriority;
}

// Current user context within a project
export interface ProjectUserContext {
  userId: string;
  projectId: string;
  role: UserRole;
  displayName: string;
  standbyTeams: boolean;
  fixedPositions: boolean;
}
