export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Plan {
  id: string;
  name: string;
  totalCreditsTarget: number;
  ipkTarget: number;
  _count?: { semesters: number };
}

export interface Course {
  id: string;
  name: string;
  credits: number;
  grade: string | null;
}

export interface Semester {
  id: string;
  term: number;
  label: string | null;
  ipsTarget: number | null;
}

export interface SemesterWithCourses extends Semester {
  courses: Course[];
}

export interface GradeScaleRow {
  letter: string;
  weight: number;
  sortOrder: number;
}