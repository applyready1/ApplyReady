const createId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const createEmptyResume = () => ({
  contact: { name: '', email: '', phone: '', linkedin: '' },
  summary: '',
  skills: [],
  experience: [],
  education: [],
  projects: []
});

export const createSkill = (name, category = 'Other', proficiency = '') => ({ id: createId(), name, category, proficiency });

export const createExperience = (company, title, timeline, description) => ({ id: createId(), company, title, timeline, description });

export const createEducation = (school, degree, field, timeline, description) => ({ id: createId(), school, degree, field, timeline, description });

export const createProject = (name, description, link) => ({ id: createId(), name, description, link });
