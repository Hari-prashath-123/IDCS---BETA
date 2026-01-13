import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
// Supabase removed — use Django backend via `api` instead
import { useAuth } from '../../context/AuthContext';
import api, { uploadStudentExcel, uploadStaffExcel } from '../../services/api.js';

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
  const [parentDept, setParentDept] = useState('');
  const [deptType, setDeptType] = useState<'ACADEMIC' | 'NON_ACADEMIC'>('ACADEMIC');
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
  const [newHodDepartment, setNewHodDepartment] = useState('');

  const [newAhodName, setNewAhodName] = useState('');
  const [newAhodEmail, setNewAhodEmail] = useState('');
  const [newAhodDob, setNewAhodDob] = useState('');
  const [creatingAhod, setCreatingAhod] = useState(false);
  const [newAhodDepartment, setNewAhodDepartment] = useState('');

  // create Staff state
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffFacultyId, setNewStaffFacultyId] = useState('');
  const [newStaffDob, setNewStaffDob] = useState('');
  const [newStaffRole, setNewStaffRole] = useState<'mentor' | 'advisor' | 'lecturer'>('mentor');
  const [newStaffDepartment, setNewStaffDepartment] = useState('');
  const [newStaffYear, setNewStaffYear] = useState<number>(1);
  const [newStaffSection, setNewStaffSection] = useState('');
  const [creatingStaff, setCreatingStaff] = useState(false);
  // staff import state
  const [staffImportFile, setStaffImportFile] = useState<File | null>(null);
  const [staffPreviewData, setStaffPreviewData] = useState<any[] | null>(null);
  const [staffPreviewVisible, setStaffPreviewVisible] = useState(false);
  const [staffImportDept, setStaffImportDept] = useState('');
  const [staffImportLog, setStaffImportLog] = useState<string[]>([]);
  const [importingStaff, setImportingStaff] = useState(false);
  const [staffImportAck, setStaffImportAck] = useState<string | null>(null);

  // student import state (Excel)
  const [studentImportFile, setStudentImportFile] = useState<File | null>(null);
  const [studentPreviewData, setStudentPreviewData] = useState<any[] | null>(null);
  const [studentPreviewVisible, setStudentPreviewVisible] = useState(false);
  const [studentImportLog, setStudentImportLog] = useState<string[]>([]);
  const [importingStudents, setImportingStudents] = useState(false);
  const [studentImportAck, setStudentImportAck] = useState<string | null>(null);

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
      const defaultPassword = 'Password123!';

      // Faculty ID is required
      if (!newStaffFacultyId.trim()) return setError('Faculty ID is required');

      const payload: any = {
        name: newStaffName.trim(),
        email: newStaffEmail.trim(),
        faculty_id: newStaffFacultyId.trim(),
        designation: newStaffRole,
        date_of_joining: newStaffDob || '1990-01-01',
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
        setNewStaffFacultyId('');
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

  const handleUploadStaff = async () => {
    console.debug('handleUploadStaff invoked')
    if (!staffImportFile) {
      console.debug('No staffImportFile selected')
      return setError('Please select an Excel file to import for staff')
    }
    setImportingStaff(true)
    setStaffImportLog([])
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', staffImportFile as File)
      console.debug('About to call uploadStaffExcel', { name: (staffImportFile as File).name, size: (staffImportFile as File).size })
      const res = await uploadStaffExcel(formData)
      console.debug('uploadStaffExcel resolved', res)
      const created = res.created ?? res.created_count ?? 0
      const updated = res.updated ?? 0
      const errors = res.errors ?? res.error ?? null
      const log: string[] = []
      if (created) log.push(`Created: ${created}`)
      if (updated) log.push(`Updated: ${updated}`)
      if (errors) {
        if (Array.isArray(errors)) setStaffImportLog(errors as string[])
        else setStaffImportLog([String(errors)])
      } else if (!log.length) {
        log.push(res.message || 'Staff import completed')
        setStaffImportLog(log)
      } else {
        setStaffImportLog(log)
      }

      // set acknowledgement message
      try {
        const ackMsg = errors ? 'Staff import completed with errors' : `Staff import completed — Created: ${created}, Updated: ${updated}`;
        setStaffImportAck(ackMsg);
        setTimeout(() => setStaffImportAck(null), 8000);
      } catch (e) {
        // ignore
      }

      // refresh staff list if endpoint available
      try {
        const sResp = await api.get('/staff/')
        // ignore returned data for now; UI will pick up on next refresh
        console.debug('Refreshed staff list', sResp.status)
      } catch (e) {
        console.debug('Failed to refresh staff list after import', e)
      }
    } catch (err: any) {
      console.error('Error importing staff:', err)
      if (err && err.response && err.response.data) {
        console.debug('Server error response data:', err.response.data)
        setStaffImportLog([JSON.stringify(err.response.data)])
      } else {
        setError((err && err.message) || String(err))
      }
    } finally {
      console.debug('handleUploadStaff finished; clearing importing state')
      setImportingStaff(false)
    }
  }

  const parseExcelFile = async (file: File) => {
    try {
      const mod: any = await import('xlsx')
      const XLSX = mod && (mod.default || mod)
      const arrayBuffer = await file.arrayBuffer()
      const wb = XLSX.read(arrayBuffer, { type: 'array' })
      const first = wb.SheetNames[0]
      const sheet = wb.Sheets[first]
      const json = XLSX.utils.sheet_to_json(sheet, { defval: '' })
      return json
    } catch (e) {
      console.error('Failed to parse Excel file', e)
      throw e
    }
  }

  const handlePreviewStudents = async () => {
    if (!studentImportFile) return setError('Please select an Excel file to preview')
    try {
      const rows = await parseExcelFile(studentImportFile)
      setStudentPreviewData(rows)
      setStudentPreviewVisible(true)
    } catch (e:any) {
      setError('Failed to parse student file for preview')
    }
  }

  const handleConfirmStudentsImport = async () => {
    setStudentPreviewVisible(false)
    await handleUploadStudents()
  }

  const handleCancelStudentsPreview = () => {
    setStudentPreviewVisible(false)
    setStudentPreviewData(null)
  }

  const handlePreviewStaff = async () => {
    if (!staffImportFile) return setError('Please select an Excel file to preview')
    try {
      const rows = await parseExcelFile(staffImportFile)
      setStaffPreviewData(rows)
      setStaffPreviewVisible(true)
    } catch (e:any) {
      setError('Failed to parse staff file for preview')
    }
  }

  const handleConfirmStaffImport = async () => {
    setStaffPreviewVisible(false)
    await handleUploadStaff()
  }

  const handleCancelStaffPreview = () => {
    setStaffPreviewVisible(false)
    setStaffPreviewData(null)
  }

  const downloadCSV = (filename: string, headers: string[], sample?: string[]) => {
    const rows = [headers]
    if (sample) rows.push(sample)
    const csv = rows.map(r => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const downloadStudentTemplateXlsx = async () => {
    try {
      const mod: any = await import('xlsx')
      const XLSX = (mod && (mod.default || mod))
      const headers = ['name','email','department','DOB','reg_no','roll_no','year','section','password']
      // fetch departments list
      const dres = await api.get('/departments/')
      const dlist = dres.data || []
      const items = Array.isArray(dlist) ? dlist : (dlist && dlist.results && Array.isArray(dlist.results) ? dlist.results : Object.values(dlist || {}))
      const deptNames = (items || []).map((d: any) => d && d.name).filter(Boolean)

      const wb = XLSX.utils.book_new()
      const wsData = [headers, ['John Doe','john.doe@example.com', deptNames[0] || '', '2002-05-12','REG2026001','101','1','A','']]
      const ws = XLSX.utils.aoa_to_sheet(wsData)

      // add hidden sheet with departments
      const dws = XLSX.utils.aoa_to_sheet(deptNames.map((n: string) => [n]))
      XLSX.utils.book_append_sheet(wb, ws, 'Template')
      XLSX.utils.book_append_sheet(wb, dws, 'departments')

      // create named range 'DeptList' for departments and add validation to column C
      const lastRow = 1000
      const deptRef = `departments!$A$1:$A$${deptNames.length || 1}`
      wb.Workbook = wb.Workbook || {}
      wb.Workbook.Names = wb.Workbook.Names || []
      wb.Workbook.Names.push({ Name: 'DeptList', Ref: deptRef })
      // @ts-ignore - set data validation using explicit range (no leading '=')
      ws['!dataValidation'] = ws['!dataValidation'] || []
      ws['!dataValidation'].push({ sqref: `C2:C${lastRow}`, type: 'list', allowBlank: true, formulas: [deptRef] })

      XLSX.writeFile(wb, 'students_template.xlsx')
    } catch (e) {
      console.error('Failed to generate XLSX student template', e)
      // fallback to CSV
      const headers = ['name','email','department','DOB','reg_no','roll_no','year','section','password']
      const sample = ['John Doe','john.doe@example.com','AI&DS','2002-05-12','REG2026001','101','1','A','']
      downloadCSV('students_template.csv', headers, sample)
    }
  }

  const downloadStaffTemplateXlsx = async () => {
    try {
      const mod: any = await import('xlsx')
      const XLSX = (mod && (mod.default || mod))
      const headers = ['faculty_id','name','dept','role','designation','qualification','date_of_joining','email']
      const dres = await api.get('/departments/')
      const dlist = dres.data || []
      const items = Array.isArray(dlist) ? dlist : (dlist && dlist.results && Array.isArray(dlist.results) ? dlist.results : Object.values(dlist || {}))
      const deptNames = (items || []).map((d: any) => d && d.name).filter(Boolean)

      const wb = XLSX.utils.book_new()
      const wsData = [headers, ['STF1001','Avudaiappan T', deptNames[0] || 'AI&DS','lecturer','Assistant Professor','B.E., M.E., Ph.D.','2017-09-01','avudaiappant.ai@krct.ac.in']]
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      const dws = XLSX.utils.aoa_to_sheet(deptNames.map((n: string) => [n]))
      XLSX.utils.book_append_sheet(wb, ws, 'Template')
      XLSX.utils.book_append_sheet(wb, dws, 'departments')
      const lastRow = 1000
      const deptRef = `departments!$A$1:$A$${deptNames.length || 1}`
      wb.Workbook = wb.Workbook || {}
      wb.Workbook.Names = wb.Workbook.Names || []
      wb.Workbook.Names.push({ Name: 'DeptList', Ref: deptRef })
      // @ts-ignore
      ws['!dataValidation'] = ws['!dataValidation'] || []
      ws['!dataValidation'].push({ sqref: `C2:C${lastRow}`, type: 'list', allowBlank: true, formulas: [deptRef] })
      XLSX.writeFile(wb, 'staff_template.xlsx')
    } catch (e) {
      console.error('Failed to generate XLSX staff template', e)
      const headers = ['faculty_id','name','dept','role','designation','qualification','date_of_joining','email']
      const sample = ['STF1001','Avudaiappan T','AI&DS','lecturer','Assistant Professor','B.E., M.E., Ph.D.','2017-09-01','avudaiappant.ai@krct.ac.in']
      downloadCSV('staff_template.csv', headers, sample)
    }
  }

  // Backwards-compatible wrappers used by the UI buttons
  const downloadStudentTemplate = () => {
    downloadStudentTemplateXlsx()
  }

  const downloadStaffTemplate = () => {
    downloadStaffTemplateXlsx()
  }

  const handleUploadStudents = async () => {
    console.debug('handleUploadStudents invoked')
    if (!studentImportFile) {
      console.debug('No studentImportFile selected')
      return setError('Please select an Excel file to import')
    }
    setImportingStudents(true)
    setStudentImportLog([])
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', studentImportFile as File)
      console.debug('About to call uploadStudentExcel', { name: (studentImportFile as File).name, size: (studentImportFile as File).size })
      const res = await uploadStudentExcel(formData)
      console.debug('uploadStudentExcel resolved', res)
      // server returns created/updated/errors
      const created = res.created ?? res.created_count ?? 0
      const updated = res.updated ?? 0
      const errors = res.errors ?? res.error ?? null
      const log: string[] = []
      if (created) log.push(`Created: ${created}`);
      if (updated) log.push(`Updated: ${updated}`);
      if (errors) {
        if (Array.isArray(errors)) setStudentImportLog(errors as string[]);
        else setStudentImportLog([String(errors)]);
      } else if (!log.length) {
        log.push(res.message || 'Import completed');
        setStudentImportLog(log);
      } else {
        setStudentImportLog(log);
      }

      // set acknowledgement message
      try {
        const ackMsg = errors ? 'Import completed with errors' : `Import completed — Created: ${created}, Updated: ${updated}`;
        setStudentImportAck(ackMsg);
        setTimeout(() => setStudentImportAck(null), 8000);
      } catch (e) {
        // ignore
      }

      // refresh students list
      try {
        const sResp = await api.get('/students/');
        const sData = sResp.data || [];
        const studentMap: Record<string, StudentRow> = {};
        (sData || []).forEach((s: any) => { studentMap[s.id] = s; });
        setStudents(studentMap);
      } catch (e) {
        // ignore
      }
    } catch (err: any) {
      console.error('Error importing students:', err);
      if (err.response && err.response.data) {
        setStudentImportLog([JSON.stringify(err.response.data)]);
      } else {
        setError(err.message || String(err));
      }
    } finally {
      setImportingStudents(false);
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
      // attach department mapping when selected (convert name -> id)
      const deptId = deptNameToId[newHodDepartment];
      if (deptId) payload.department = deptId;
      const result = await api.post('/staff/create/', payload);
      console.log('HOD created successfully:', result.data || result);
      const dResp = await api.get('/departments/');
      const depsData = dResp.data || [];
      setDepartments((depsData || []).map((d: any) => d.name));
      setNewHodName('');
      setNewHodEmail('');
      setNewHodDob('');
      setNewHodDepartment('');
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
      const deptId = deptNameToId[newAhodDepartment];
      if (deptId) payload.department = deptId;
      const result = await api.post('/staff/create/', payload);
      console.log('AHOD created successfully:', result.data || result);
      const dResp = await api.get('/departments/');
      const depsData = dResp.data || [];
      setDepartments((depsData || []).map((d: any) => d.name));
      setNewAhodName('');
      setNewAhodEmail('');
      setNewAhodDob('');
      setNewAhodDepartment('');
      alert(`AHOD created successfully!\nEmail: ${newAhodEmail.trim()}\nPassword: ${defaultPassword}\n(User can now log in)`);
    } catch (err: any) {
      console.error('Error creating AHOD:', err);
      setError(err.message || String(err));
    } finally {
      setCreatingAhod(false);
    }
  };

  const handleCreateDepartment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newDeptName.trim()) return setError('Please enter department name');
    setSubmitting(true);
    setError(null);
    try {
      const payload: any = { name: newDeptName.trim() };
      // attach parent by id when possible
      if (parentDept) {
        const pid = deptNameToId[parentDept];
        payload.parent = pid ? pid : parentDept;
      }
      if (deptType) payload.type = deptType;

      const resp = await api.post('/departments/', payload);
      if (resp.status === 201 || resp.status === 200) {
        // refresh departments list
        try {
          const dResp = await api.get('/departments/');
          const full = dResp.data || [];
          const items = Array.isArray(full) ? full : (full.results && Array.isArray(full.results) ? full.results : Object.values(full || {}));
          const names = (items || []).map((d: any) => d && d.name).filter(Boolean);
          const map: Record<string, number> = {};
          (items || []).forEach((d: any) => { if (d && d.name) map[d.name] = d.id });
          setDepartments(names as string[]);
          setDeptNameToId(map);
        } catch (e) {
          // ignore refresh errors
        }
        setNewDeptName('');
        setParentDept('');
        setDeptType('ACADEMIC');
        alert('Department created');
      }
    } catch (err: any) {
      console.error('Error creating department:', err);
      setError((err && err.message) || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  // Staff CSV import button was previously simplified to use API; keep that behavior

  const sidebarItems = [
    { label: 'Dashboard', path: '/admin-dashboard', icon: null },
    { label: 'Manage Students', path: '/admin/students', icon: null },
    { label: 'Manage Staff', path: '/admin/staff', icon: null },
    { label: 'Create', path: '/admin/create', icon: null },
    { label: 'Views', path: '/admin/views', icon: null },
    { label: 'Add Curriculum', path: '/admin/add-curriculum', icon: null },
  ];

  return (
    <DashboardLayout sidebarItems={sidebarItems}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800">Departments</h1>
          <p className="text-slate-600 mt-1">List of departments and their HOD/AHOD/staff/students</p>
        </div>

        {/* Bulk import students via Excel */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <h3 className="text-md font-medium mb-3">Bulk Import Students (Excel)</h3>
          <p className="text-sm text-slate-600 mb-3">Upload an Excel file with columns: name, email, department, DOB, reg_no, roll_no, year, section, password</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setStudentImportFile(e.target.files ? e.target.files[0] : null)} />
            </div>
              <div className="flex items-center space-x-2">
                <button onClick={handleUploadStudents} disabled={importingStudents} className="py-2 px-4 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                  {importingStudents ? 'Importing...' : 'Upload Students'}
                </button>
                <button onClick={handlePreviewStudents} disabled={importingStudents} className="py-2 px-3 bg-slate-100 border rounded hover:bg-slate-200 text-sm">Preview</button>
                <button type="button" onClick={() => downloadStudentTemplate()} className="py-2 px-3 bg-slate-100 border rounded hover:bg-slate-200 text-sm">Download template</button>
              </div>
              {studentImportAck && (
                <div className="mt-2 text-sm text-green-700">{studentImportAck}</div>
              )}
            <div>
              {studentImportFile && <div className="text-sm text-slate-700">Selected: {studentImportFile.name}</div>}
            </div>
          </div>
          {studentImportLog.length > 0 && (
            <div className="mt-2">
              <h4 className="font-medium text-sm mb-1">Import Log</h4>
              <ul className="text-sm list-disc pl-5">
                {studentImportLog.map((l, idx) => <li key={idx} className="text-slate-700">{l}</li>)}
              </ul>
            </div>
          )}
          {studentPreviewVisible && studentPreviewData && (
            <div className="mt-4 bg-white border rounded p-3">
              <h4 className="font-medium mb-2">Preview Student Import ({studentPreviewData.length} rows)</h4>
              <div className="overflow-x-auto max-h-64 overflow-y-auto border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      {Object.keys(studentPreviewData[0] || {}).map((k) => (
                        <th key={k} className="px-2 py-1 text-left">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {studentPreviewData.map((row, idx) => (
                      <tr key={idx} className="border-t">
                        {Object.keys(studentPreviewData[0] || {}).map((k) => (
                          <td key={k} className="px-2 py-1">{String((row as any)[k] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex justify-end space-x-2">
                <button onClick={handleCancelStudentsPreview} className="px-3 py-1 border rounded">Cancel</button>
                <button onClick={handleConfirmStudentsImport} className="px-3 py-1 bg-indigo-600 text-white rounded">Confirm Import</button>
              </div>
            </div>
          )}
        </div>

        {/* Bulk import staff via Excel */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <h3 className="text-md font-medium mb-3">Bulk Import Staff (Excel)</h3>
          <p className="text-sm text-slate-600 mb-3">Upload an Excel file with columns: id, name, dept, role, designation, qualification, date of joining. Leave any column empty (except faculty id) to keep it unchanged.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
                <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setStaffImportFile(e.target.files ? e.target.files[0] : null)} />
            </div>
              <div className="flex items-center space-x-2">
                <button onClick={handleUploadStaff} disabled={importingStaff} className="py-2 px-4 bg-green-600 text-white rounded hover:bg-green-700">
                  {importingStaff ? 'Importing...' : 'Upload Staff'}
                </button>
                <button onClick={handlePreviewStaff} disabled={importingStaff} className="py-2 px-3 bg-slate-100 border rounded hover:bg-slate-200 text-sm">Preview</button>
                <button type="button" onClick={() => downloadStaffTemplate()} className="py-2 px-3 bg-slate-100 border rounded hover:bg-slate-200 text-sm">Download template</button>
              </div>
              {staffImportAck && (
                <div className="mt-2 text-sm text-green-700">{staffImportAck}</div>
              )}
            <div>
              {staffImportFile && <div className="text-sm text-slate-700">Selected: {staffImportFile.name}</div>}
            </div>
          </div>
          {staffImportLog.length > 0 && (
            <div className="mt-2">
              <h4 className="font-medium text-sm mb-1">Import Log</h4>
              <ul className="text-sm list-disc pl-5">
                {staffImportLog.map((l, idx) => <li key={idx} className="text-slate-700">{l}</li>)}
              </ul>
            </div>
          )}
          {staffPreviewVisible && staffPreviewData && (
            <div className="mt-4 bg-white border rounded p-3">
              <h4 className="font-medium mb-2">Preview Staff Import ({staffPreviewData.length} rows)</h4>
              <div className="overflow-x-auto max-h-64 overflow-y-auto border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 sticky top-0">
                    <tr>
                      {Object.keys(staffPreviewData[0] || {}).map((k) => (
                        <th key={k} className="px-2 py-1 text-left">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {staffPreviewData.map((row, idx) => (
                      <tr key={idx} className="border-t">
                        {Object.keys(staffPreviewData[0] || {}).map((k) => (
                          <td key={k} className="px-2 py-1">{String((row as any)[k] ?? '')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex justify-end space-x-2">
                <button onClick={handleCancelStaffPreview} className="px-3 py-1 border rounded">Cancel</button>
                <button onClick={handleConfirmStaffImport} className="px-3 py-1 bg-green-600 text-white rounded">Confirm Import</button>
              </div>
            </div>
          )}
        </div>

        {/* Create Staff */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
          <h3 className="text-md font-medium mb-3">Create Staff (Mentor/Advisor/Lecturer)</h3>
          <form onSubmit={handleCreateStaff} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
              <div>
                <label className="block text-sm text-slate-600 mb-1">Faculty ID *</label>
                <input
                  value={newStaffFacultyId}
                  onChange={(e) => setNewStaffFacultyId(e.target.value)}
                  placeholder="e.g., STF1001"
                  className="w-full px-3 py-2 border rounded"
                />
                {newStaffErrors.faculty_id && <div className="text-red-600 text-sm mt-1">{newStaffErrors.faculty_id}</div>}
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

        {/* Create HOD / AHOD credentials */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h3 className="text-md font-medium mb-3">Create HOD / AHOD Credentials</h3>
          <p className="text-sm text-slate-600 mb-3">Create a Head/AHOD account and map to a department. Default password: <strong>Password123!</strong></p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded">
              <h4 className="font-medium mb-2">Create HOD</h4>
              <div className="space-y-2">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Name *</label>
                  <input value={newHodName} onChange={(e) => setNewHodName(e.target.value)} className="w-full px-3 py-2 border rounded" />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Email *</label>
                  <input value={newHodEmail} onChange={(e) => setNewHodEmail(e.target.value)} className="w-full px-3 py-2 border rounded" />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Department</label>
                  <select value={newHodDepartment} onChange={(e) => setNewHodDepartment(e.target.value)} className="w-full px-3 py-2 border rounded">
                    <option value="">— Select Department —</option>
                    {staffDepartments.map((d) => (<option key={d} value={d}>{d}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Date of birth</label>
                  <input type="date" value={newHodDob} onChange={(e) => setNewHodDob(e.target.value)} className="w-full px-3 py-2 border rounded" />
                </div>
                <div className="flex items-center space-x-2">
                  <button onClick={handleCreateHod} disabled={creatingHod} className="py-2 px-4 bg-indigo-600 text-white rounded hover:bg-indigo-700">{creatingHod ? 'Creating...' : 'Create HOD'}</button>
                  <button onClick={() => { setNewHodName(''); setNewHodEmail(''); setNewHodDob(''); setNewHodDepartment(''); }} className="py-2 px-4 border rounded">Reset</button>
                </div>
              </div>
            </div>

            <div className="p-4 border rounded">
              <h4 className="font-medium mb-2">Create AHOD</h4>
              <div className="space-y-2">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Name *</label>
                  <input value={newAhodName} onChange={(e) => setNewAhodName(e.target.value)} className="w-full px-3 py-2 border rounded" />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Email *</label>
                  <input value={newAhodEmail} onChange={(e) => setNewAhodEmail(e.target.value)} className="w-full px-3 py-2 border rounded" />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Department</label>
                  <select value={newAhodDepartment} onChange={(e) => setNewAhodDepartment(e.target.value)} className="w-full px-3 py-2 border rounded">
                    <option value="">— Select Department —</option>
                    {staffDepartments.map((d) => (<option key={d} value={d}>{d}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Date of birth</label>
                  <input type="date" value={newAhodDob} onChange={(e) => setNewAhodDob(e.target.value)} className="w-full px-3 py-2 border rounded" />
                </div>
                <div className="flex items-center space-x-2">
                  <button onClick={handleCreateAhod} disabled={creatingAhod} className="py-2 px-4 bg-indigo-600 text-white rounded hover:bg-indigo-700">{creatingAhod ? 'Creating...' : 'Create AHOD'}</button>
                  <button onClick={() => { setNewAhodName(''); setNewAhodEmail(''); setNewAhodDob(''); setNewAhodDepartment(''); }} className="py-2 px-4 border rounded">Reset</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Create department form */}
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Create Department</h2>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4">{error}</div>}
          <form onSubmit={handleCreateDepartment} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Department Name *</label>
                <input value={newDeptName} onChange={(e) => setNewDeptName(e.target.value)} placeholder="e.g., AI & DS" className="w-full px-3 py-2 border rounded" />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Parent Department</label>
                <select value={parentDept} onChange={(e) => setParentDept(e.target.value)} className="w-full px-3 py-2 border rounded">
                  <option value="">None</option>
                  {departments.map((d) => (<option key={d} value={d}>{d}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">Type</label>
                <select value={deptType} onChange={(e) => setDeptType(e.target.value as any)} className="w-full px-3 py-2 border rounded">
                  <option value="ACADEMIC">Academic</option>
                  <option value="NON_ACADEMIC">Non-academic</option>
                </select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button type="submit" disabled={submitting} className="py-2 px-4 bg-emerald-600 text-white rounded hover:bg-emerald-700">{submitting ? 'Creating...' : 'Create Department'}</button>
              <button type="button" onClick={() => { setNewDeptName(''); setParentDept(''); setDeptType('ACADEMIC'); }} className="py-2 px-4 border rounded hover:bg-slate-50">Reset</button>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
