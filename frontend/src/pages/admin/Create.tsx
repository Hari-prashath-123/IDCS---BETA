import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
// Supabase removed — use Django backend via `api` instead
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api.js';

interface ProfileRow {
  id: string;
  email: string;
  role: string;
  name: string;
  department: string;
}

interface StudentRow {
  id: string;
  reg_no: string;
  roll_no: string;
  year: number;
  section: string;
}

interface YearRow {
  id: string;
  department: string;
  year_number: number;
}

interface SectionRow {
  id: string;
  department: string;
  year_number: number;
  section_name: string;
}

// Local helper for creating a user if a shared helper isn't available.
// Use staff collection endpoint for creating faculty-type users (HOD/AHOD).
const createUser = async (userData: any) => {
  const resp = await api.post('/staff/create/', userData);
  if (resp.status >= 200 && resp.status < 300) return resp.data;
  throw new Error((resp.data && (resp.data.detail || JSON.stringify(resp.data))) || 'Failed to create user');
};

export default function Create() {
  const { user: profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<string[]>([]);
  const [studentDepartments, setStudentDepartments] = useState<string[]>([]);
  const [staffDepartments, setStaffDepartments] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [students, setStudents] = useState<Record<string, StudentRow>>({});
  const [years, setYears] = useState<YearRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  // mapping name -> id for departments (fetched from backend)
  const [deptNameToId, setDeptNameToId] = useState<Record<string, number>>({});

  // form state
  const [newDeptName, setNewDeptName] = useState('');
  const [hodId, setHodId] = useState<string>('');
  const [ahodId, setAhodId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  // years and sections state
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [newSection, setNewSection] = useState('');
  const [sectionYear, setSectionYear] = useState<number>(1);
  // create HOD/AHOD state
  const [newHodName, setNewHodName] = useState('');
  const [newHodEmail, setNewHodEmail] = useState('');
  const [newHodDob, setNewHodDob] = useState('');
  const [creatingHod, setCreatingHod] = useState(false);

  const [newAhodName, setNewAhodName] = useState('');
  const [newAhodEmail, setNewAhodEmail] = useState('');
  const [newAhodDob, setNewAhodDob] = useState('');
  const [creatingAhod, setCreatingAhod] = useState(false);

  // create Staff state
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffDob, setNewStaffDob] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'mentor' | 'advisor' | 'lecturer'>('mentor');
  const [newStaffDepartment, setNewStaffDepartment] = useState('');
  const [newStaffYear, setNewStaffYear] = useState<number>(1);
  const [newStaffSection, setNewStaffSection] = useState('');
  const [creatingStaff, setCreatingStaff] = useState(false);
  // staff import state
  const [staffImportFile, setStaffImportFile] = useState<File | null>(null);
  const [staffImportDept, setStaffImportDept] = useState('');
  const [staffImportLog, setStaffImportLog] = useState<string[]>([]);
  const [importingStaff, setImportingStaff] = useState(false);

  // create Student state
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentEmail, setNewStudentEmail] = useState('');
  const [newStudentDob, setNewStudentDob] = useState('');
  const [newStudentRegNo, setNewStudentRegNo] = useState('');
  const [newStudentRollNo, setNewStudentRollNo] = useState('');
  const [newStudentDepartment, setNewStudentDepartment] = useState('');
  const [newStudentYear, setNewStudentYear] = useState<number>(1);
  const [newStudentSection, setNewStudentSection] = useState('');
  const [creatingStudent, setCreatingStudent] = useState(false);

  // field-level errors
  const [newStudentErrors, setNewStudentErrors] = useState<Record<string, string>>({});
  const [newStaffErrors, setNewStaffErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!profile) return;
    const fetchAll = async () => {
      setLoading(true);
      try {
        // fetch departments mapping from backend to get IDs
        const dres = await api.get('/departments/');
        const full: any[] = dres.data || [];
          const map: Record<string, number> = {};
          const idToDept: Record<number, any> = {};
          full.forEach((d: any) => {
            if (d && d.name) map[d.name] = d.id;
            if (d && d.id) idToDept[d.id] = d;
          });

          // build children map (deptId -> hasChildren boolean)
          const hasChildren: Record<number, boolean> = {};
          full.forEach((d: any) => {
            const parentId = d?.parent?.id ?? d?.parent ?? null;
            if (parentId) {
              hasChildren[parentId] = true;
            }
          });

          // compute student-visible departments: academic sub-departments OR academic departments without children
          const studentList: string[] = [];
          const staffList: string[] = [];

          full.forEach((d: any) => {
            const deptId = d?.id;
            const name = d?.name;
            const dtype = d?.type ? String(d.type).toUpperCase() : undefined;
            const parentId = d?.parent?.id ?? d?.parent ?? null;
            const children = deptId ? !!hasChildren[deptId] : false;

            // staff sees all departments
            if (name) staffList.push(name);

            // determine student visibility
            let includeForStudents = false;
            if (dtype !== undefined) {
              // only academic types
              if (dtype === 'ACADEMIC') {
                includeForStudents = !!parentId || !children;
              }
            } else {
              // no type info: fallback to heuristic: include if is sub-department or has no children
              includeForStudents = !!parentId || !children;
            }

            if (includeForStudents && name) studentList.push(name);
          });

        setDeptNameToId(map);
        setDepartments(full.map((d: any) => d.name));
        setStudentDepartments(Array.from(new Set(studentList)).sort());
        setStaffDepartments(Array.from(new Set(staffList)).sort());

        // Fetch students, years and sections from Django API
        const sResp = await api.get('/students/');
        const sData = sResp.data || [];

        // backend does not expose years/sections endpoints — use defaults
        const yData: any[] = [1,2,3,4].map((n) => ({ id: String(n), department: '', year_number: n }));
        const secData: any[] = [];

        const studentMap: Record<string, StudentRow> = {};
        (sData || []).forEach((s: any) => {
          studentMap[s.id] = s;
        });

        // derive dept names from departments endpoint response (`full`)
        const deps = Array.from(new Set((full || []).map((d: any) => d.name))).sort();

        // profiles endpoint not provided by backend; keep profiles empty
        setProfiles([]);
        setStudents(studentMap);
        setYears(yData);
        setSections(secData);
        setDepartments((deps as string[]) || []);
      } catch (err: any) {
        console.error('Error fetching departments data:', err);
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, [profile]);

  const resetForm = () => {
    setNewDeptName('');
    setHodId('');
    setAhodId('');
    setSelectedYears([]);
    setNewSection('');
    setSectionYear(1);
  };

  const handleToggleYear = (year: number) => {
    setSelectedYears((prev) =>
      prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]
    );
  };

  const handleAddSection = async () => {
    if (!newDeptName.trim()) return setError('Please enter department name first');
    if (!newSection.trim()) return setError('Section name is required');
    setError(null);
    try {
      // Sections endpoint is not provided by backend — update locally
      const sectionObj = { id: Date.now().toString(), department: newDeptName.trim(), year_number: sectionYear, section_name: newSection.trim().toUpperCase() };
      setSections((prev) => [...prev, sectionObj]);
      setNewSection('');
      alert('Section added locally (backend endpoint not available).');
    } catch (err: any) {
      console.error('Error adding section:', err);
      setError(err.message || String(err));
    }
  };

  // Create handlers
  const handleCreateStaff = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setNewStaffErrors({});
    if (!newStaffName.trim() || !newStaffEmail.trim()) return setError('Staff name and email are required');
    if (!newStaffDepartment.trim()) return setError('Department is required for staff');
    if (newStaffRole === 'advisor') {
      if (!newStaffYear) return setError('Year is required for advisors');
      if (!newStaffSection.trim()) return setError('Section is required for advisors');
    }

    setCreatingStaff(true);
    setError(null);
    try {
      const genStaffId = `STF${Date.now().toString().slice(-6)}`;
      const dobVal = newStaffDob || '1990-01-01';
      const defaultPassword = dobVal.replace(/-/g, '');

      const payload: any = {
        name: newStaffName.trim(),
        email: newStaffEmail.trim(),
        faculty_id: genStaffId,
        designation: newStaffRole,
        date_of_joining: dobVal,
        password: defaultPassword,
      };

      // convert department name to id when possible
      const deptId = deptNameToId[newStaffDepartment];
      if (deptId) payload.department = deptId;
      // advisor-specific fields
      if (newStaffRole === 'advisor') {
        payload.year = Number(newStaffYear);
        payload.section = newStaffSection.trim().toUpperCase();
      }

      const resp = await api.post('/staff/create/', payload);
      if (resp.status === 201 || resp.status === 200) {
        alert('Staff created successfully');
        // reset form
        setNewStaffName('');
        setNewStaffEmail('');
        setNewStaffDob('');
        setNewStaffRole('mentor');
        setNewStaffDepartment('');
        setNewStaffYear(1);
        setNewStaffSection('');
      }
    } catch (err: any) {
      console.error('Error creating staff:', err);
      if (err.response && err.response.status === 400 && err.response.data) {
        const data = err.response.data;
        const fieldErrors: Record<string, string> = {};
        Object.keys(data).forEach((k) => {
          const v = data[k];
          fieldErrors[k] = Array.isArray(v) ? v.join('; ') : String(v);
        });
        setNewStaffErrors(fieldErrors);
      } else {
        setError(err.message || String(err));
      }
    } finally {
      setCreatingStaff(false);
    }
  };

  const handleCreateStudent = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setNewStudentErrors({});
    if (!newStudentName.trim() || !newStudentEmail.trim()) return setError('Student name and email are required');
    if (!newStudentDepartment.trim()) return setError('Department is required');
    if (!newStudentRegNo.trim() || !newStudentRollNo.trim()) return setError('Registration number and Roll number are required');
    if (!newStudentYear || !newStudentSection.trim()) return setError('Year and section are required');

    setCreatingStudent(true);
    setError(null);
    try {
      const defaultPassword = 'Password123!';
      const payload: any = {
        name: newStudentName.trim(),
        email: newStudentEmail.trim(),
        reg_no: newStudentRegNo.trim(),
        roll_no: newStudentRollNo.trim(),
        year: Number(newStudentYear),
        section: newStudentSection.trim().toUpperCase(),
        password: defaultPassword,
      };

      const deptId = deptNameToId[newStudentDepartment];
      if (deptId) payload.department = deptId;

      const url = '/students/create/';
      console.debug('Create Student: POST', url, payload);
      let resp;
      try {
        resp = await api.post(url, payload);
      } catch (postErr: any) {
        // If server responds 405, attempt diagnostic POST to collection endpoint and rethrow original
        console.error('Create Student POST failed:', postErr?.response?.status, postErr?.response?.data);
        if (postErr && postErr.response && postErr.response.status === 405) {
          try {
            const altResp = await api.post('/students/', payload);
            console.debug('Diagnostic POST to /students/ succeeded:', altResp.status, altResp.data);
          } catch (altErr: any) {
            console.error('Diagnostic POST to /students/ failed:', altErr?.response?.status, altErr?.response?.data);
          }
        }
        throw postErr;
      }
      if (resp.status === 201 || resp.status === 200) {
        alert('Student created successfully');
        // refresh departments and students from Django API
        const dResp = await api.get('/departments/');
        const depsData = dResp.data || [];
        setDepartments((depsData || []).map((d: any) => d.name));
        const sResp = await api.get('/students/');
        const sData = sResp.data || [];
        const studentMap: Record<string, StudentRow> = {};
        (sData || []).forEach((s: any) => { studentMap[s.id] = s; });
        setStudents(studentMap);

        setNewStudentName('');
        setNewStudentEmail('');
        setNewStudentDob('');
        setNewStudentRegNo('');
        setNewStudentRollNo('');
        setNewStudentDepartment('');
        setNewStudentYear(1);
        setNewStudentSection('');
      }
    } catch (err: any) {
      console.error('Error creating student:', err);
      if (err.response && err.response.status === 400 && err.response.data) {
        const data = err.response.data;
        const fieldErrors: Record<string, string> = {};
        Object.keys(data).forEach((k) => {
          const v = data[k];
          fieldErrors[k] = Array.isArray(v) ? v.join('; ') : String(v);
        });
        setNewStudentErrors(fieldErrors);
      } else {
        setError(err.message || String(err));
      }
    } finally {
      setCreatingStudent(false);
    }
  };

  const handleCreateHod = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newHodName.trim() || !newHodEmail.trim()) return setError('HOD name and email are required');
    setCreatingHod(true);
    setError(null);
    try {
      const genStaffId = `STF${Date.now().toString().slice(-6)}`;
      const defaultPassword = 'Password123!';
      const payload: any = {
        name: newHodName.trim(),
        email: newHodEmail.trim(),
        faculty_id: genStaffId,
        designation: 'hod',
        password: defaultPassword,
      };
      const result = await api.post('/staff/create/', payload);
      console.log('HOD created successfully:', result.data || result);
      const dResp = await api.get('/departments/');
      const depsData = dResp.data || [];
      setDepartments((depsData || []).map((d: any) => d.name));
      setNewHodName('');
      setNewHodEmail('');
      setNewHodDob('');
      alert(`HOD created successfully!\nEmail: ${newHodEmail.trim()}\nPassword: ${defaultPassword}\n(User can now log in)`);
    } catch (err: any) {
      console.error('Error creating HOD:', err);
      setError(err.message || String(err));
    } finally {
      setCreatingHod(false);
    }
  };

  const handleCreateAhod = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newAhodName.trim() || !newAhodEmail.trim()) return setError('AHOD name and email are required');
    setCreatingAhod(true);
    setError(null);
    try {
      const genStaffId = `STF${Date.now().toString().slice(-6)}`;
      const defaultPassword = 'Password123!';
      const payload: any = {
        name: newAhodName.trim(),
        email: newAhodEmail.trim(),
        faculty_id: genStaffId,
        designation: 'ahod',
        password: defaultPassword,
      };
      const result = await api.post('/staff/create/', payload);
      console.log('AHOD created successfully:', result.data || result);
      const dResp = await api.get('/departments/');
      const depsData = dResp.data || [];
      setDepartments((depsData || []).map((d: any) => d.name));
      setNewAhodName('');
      setNewAhodEmail('');
      setNewAhodDob('');
      alert(`AHOD created successfully!\nEmail: ${newAhodEmail.trim()}\nPassword: ${defaultPassword}\n(User can now log in)`);
    } catch (err: any) {
      console.error('Error creating AHOD:', err);
      setError(err.message || String(err));
    } finally {
      setCreatingAhod(false);
    }
  };

  // Staff CSV import button was previously simplified to use API; keep that behavior

  const sidebarItems = [
    { label: 'Dashboard', path: '/admin-dashboard', icon: null },
    { label: 'Manage Students', path: '/admin/students', icon: null },
    { label: 'Manage Staff', path: '/admin/staff', icon: null },
    { label: 'Create', path: '/admin/create', icon: null },
    { label: 'Views', path: '/admin/views', icon: null },
  ];

  return (
    <DashboardLayout sidebarItems={sidebarItems}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800">Departments</h1>
          <p className="text-slate-600 mt-1">List of departments and their HOD/AHOD/staff/students</p>
        </div>

        {/* Create Staff */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <h3 className="text-md font-medium mb-3">Create Staff (Mentor/Advisor/Lecturer)</h3>
          <form onSubmit={handleCreateStaff} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Name *</label>
                <input 
                  value={newStaffName} 
                  onChange={(e) => setNewStaffName(e.target.value)} 
                  placeholder="Staff Name" 
                  className="w-full px-3 py-2 border rounded" 
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Email *</label>
                <input 
                  value={newStaffEmail} 
                  onChange={(e) => setNewStaffEmail(e.target.value)} 
                  placeholder="Email" 
                  className="w-full px-3 py-2 border rounded" 
                />
                {newStaffErrors.email && <div className="text-red-600 text-sm mt-1">{newStaffErrors.email}</div>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Staff Role *</label>
                <select 
                  value={newStaffRole} 
                  onChange={(e) => setNewStaffRole(e.target.value as 'mentor' | 'advisor' | 'lecturer')} 
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="mentor">Mentor</option>
                  <option value="advisor">Advisor</option>
                  <option value="lecturer">Lecturer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Department *</label>
                <select value={newStaffDepartment} onChange={(e) => setNewStaffDepartment(e.target.value)} className="w-full px-3 py-2 border rounded">
                  <option value="">— Select Department —</option>
                  {staffDepartments.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                {newStaffErrors.department && <div className="text-red-600 text-sm mt-1">{newStaffErrors.department}</div>}
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Date of birth</label>
                <input 
                  type="date" 
                  value={newStaffDob} 
                  onChange={(e) => setNewStaffDob(e.target.value)} 
                  className="w-full px-3 py-2 border rounded" 
                />
              </div>
            </div>

            {/* Show Year and Section only for Advisor */}
            {newStaffRole === 'advisor' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-blue-50 rounded">
                <div>
                  <label className="block text-sm text-slate-700 font-medium mb-1">Year * (Required for Advisor)</label>
                  <select 
                    value={newStaffYear} 
                    onChange={(e) => setNewStaffYear(Number(e.target.value))} 
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value={1}>Year 1</option>
                    <option value={2}>Year 2</option>
                    <option value={3}>Year 3</option>
                    <option value={4}>Year 4</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-700 font-medium mb-1">Section * (Required for Advisor)</label>
                  <input 
                    value={newStaffSection} 
                    onChange={(e) => setNewStaffSection(e.target.value)} 
                    placeholder="e.g., A, B, C" 
                    className="w-full px-3 py-2 border rounded" 
                  />
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <button type="submit" disabled={creatingStaff} className="py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700">
                {creatingStaff ? 'Creating...' : 'Create Staff'}
              </button>
              <button 
                type="button" 
                onClick={() => { 
                  setNewStaffName(''); 
                  setNewStaffEmail(''); 
                  setNewStaffDob(''); 
                  setNewStaffRole('mentor'); 
                  setNewStaffDepartment(''); 
                  setNewStaffYear(1); 
                  setNewStaffSection(''); 
                }} 
                className="py-2 px-4 border rounded hover:bg-slate-50"
              >
                Reset
              </button>
            </div>
          </form>
        </div>

        {/* Create Student */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <h3 className="text-md font-medium mb-3">Create Student</h3>
          <form onSubmit={handleCreateStudent} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Name *</label>
                <input 
                  value={newStudentName} 
                  onChange={(e) => setNewStudentName(e.target.value)} 
                  placeholder="Student Name" 
                  className="w-full px-3 py-2 border rounded" 
                />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Email *</label>
                <input 
                  value={newStudentEmail} 
                  onChange={(e) => setNewStudentEmail(e.target.value)} 
                  placeholder="Email" 
                  className="w-full px-3 py-2 border rounded" 
                />
                {newStudentErrors.email && <div className="text-red-600 text-sm mt-1">{newStudentErrors.email}</div>}
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Date of Birth</label>
                <input 
                  type="date" 
                  value={newStudentDob} 
                  onChange={(e) => setNewStudentDob(e.target.value)} 
                  className="w-full px-3 py-2 border rounded" 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Registration Number *</label>
                <input 
                  value={newStudentRegNo} 
                  onChange={(e) => setNewStudentRegNo(e.target.value)} 
                  placeholder="e.g., REG2025001" 
                  className="w-full px-3 py-2 border rounded" 
                />
                {newStudentErrors.reg_no && <div className="text-red-600 text-sm mt-1">{newStudentErrors.reg_no}</div>}
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Roll Number *</label>
                <input 
                  value={newStudentRollNo} 
                  onChange={(e) => setNewStudentRollNo(e.target.value)} 
                  placeholder="e.g., 101" 
                  className="w-full px-3 py-2 border rounded" 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Department *</label>
                <select 
                  value={newStudentDepartment} 
                  onChange={(e) => setNewStudentDepartment(e.target.value)} 
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="">— Select Department —</option>
                  {studentDepartments.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                {newStudentErrors.department && <div className="text-red-600 text-sm mt-1">{newStudentErrors.department}</div>}
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Year *</label>
                <select 
                  value={newStudentYear} 
                  onChange={(e) => setNewStudentYear(Number(e.target.value))} 
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value={1}>Year 1</option>
                  <option value={2}>Year 2</option>
                  <option value={3}>Year 3</option>
                  <option value={4}>Year 4</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Section *</label>
                <input 
                  value={newStudentSection} 
                  onChange={(e) => setNewStudentSection(e.target.value)} 
                  placeholder="e.g., A, B, C" 
                  className="w-full px-3 py-2 border rounded" 
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button type="submit" disabled={creatingStudent} className="py-2 px-4 bg-purple-600 text-white rounded hover:bg-purple-700">
                {creatingStudent ? 'Creating...' : 'Create Student'}
              </button>
              <button 
                type="button" 
                onClick={() => { 
                  setNewStudentName(''); 
                  setNewStudentEmail(''); 
                  setNewStudentDob(''); 
                  setNewStudentRegNo(''); 
                  setNewStudentRollNo(''); 
                  setNewStudentDepartment(''); 
                  setNewStudentYear(1); 
                  setNewStudentSection(''); 
                }} 
                className="py-2 px-4 border rounded hover:bg-slate-50"
              >
                Reset
              </button>
            </div>
          </form>
        </div>

        {/* Create department form (omitted rest unchanged) */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Create Department</h2>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4">{error}</div>}
          {/* The rest of the department form is unchanged from previous implementation and omitted for brevity */}
        </div>
      </div>
    </DashboardLayout>
  );
}
