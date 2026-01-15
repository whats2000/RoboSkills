// Skill category types - skills can now belong to MULTIPLE categories
export interface Subcategory {
  id: string;
  name: string;
  description?: string;
  // Skills can belong to multiple categories - this creates the overlap!
  belongsTo: string[]; // array of category IDs
}

export interface SkillCategory {
  id: string;
  name: string;
  color: string;
  description?: string;
}

// Proficiency levels
export type ProficiencyLevel =
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'expert';

export const PROFICIENCY_LABELS: Record<ProficiencyLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
};

export const PROFICIENCY_COLORS: Record<ProficiencyLevel, string> = {
  beginner: '#bdc3c7', // Light Grey
  intermediate: '#2ecc71', // Emerald Green
  advanced: '#3498db', // Bright Blue
  expert: '#d770ad', // Pinkish Purple
};

// Member skill entry - just references the skill ID and proficiency
export interface MemberSkill {
  skillId: string; // references a skill in the skills array
  proficiency: ProficiencyLevel;
}

// Lab member
export interface LabMember {
  id: string;
  name: string;
  avatar?: string;
  role: string;
  email?: string;
  github?: string;
  skills: MemberSkill[];
}

// Full data structure - skills are now a separate array
export interface SkillsData {
  categories: SkillCategory[];
  skills: Subcategory[]; // all skills with their category overlaps
  members: LabMember[];
}

// For gap analysis
export interface SkillGap {
  skill: Subcategory;
  categories: SkillCategory[];
  currentCoverage: number;
  expertCount: number;
  recommendation: string;
}
