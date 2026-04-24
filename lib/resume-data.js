export const createEmptyResume = () => ({ contact: { name: '', email: '', phone: '', linkedin: '' }, summary: '', skills: [], experience: [], education: [], projects: [] });

export const createSkill = (name, category = 'Other', proficiency = '') => ({ id: Date.now() + Math.random(), name, category, proficiency });

export const createExperience = (company, title, timeline, description) => ({ id: Date.now() + Math.random(), company, title, timeline, description });

export const createEducation = (school, degree, field, timeline, description) => ({ id: Date.now() + Math.random(), school, degree, field, timeline, description });

export const createProject = (name, description, link) => ({ id: Date.now() + Math.random(), name, description, link });

// State update helpers will be handled directly via React state in the dashboard!