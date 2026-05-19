import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as faceapi from '@vladmandic/face-api';
import Webcam from 'react-webcam';
import { QRCodeSVG } from 'qrcode.react';

const InputField = ({ label, type, value, onChange, placeholder, required = true }) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const currentType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
        <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
            <div className="relative">
                <input
                    type={currentType} required={required} value={value} onChange={onChange} placeholder={placeholder}
                    className={`w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition shadow-sm outline-none bg-white/50 backdrop-blur-sm ${isPassword ? 'pr-12' : ''}`}
                />
                {isPassword && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors focus:outline-none p-1"
                        title={showPassword ? "Hide password" : "Show password"}
                    >
                        {showPassword ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"></path></svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.543 7-1.275 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
};

const PasswordStrengthMeter = ({ password }) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    const getStrengthColor = () => {
        switch (strength) {
            case 0: return 'bg-gray-200';
            case 1: return 'bg-red-500';
            case 2: return 'bg-yellow-500';
            case 3: return 'bg-blue-500';
            case 4: return 'bg-green-500';
            default: return 'bg-gray-200';
        }
    };

    const getStrengthLabel = () => {
        if (!password) return '';
        switch (strength) {
            case 1: return 'Weak';
            case 2: return 'Fair';
            case 3: return 'Good';
            case 4: return 'Strong';
            default: return '';
        }
    };

    return (
        <div className="mb-4">
            <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold text-gray-700">Password Strength</span>
                <span className={`text-xs font-bold ${strength === 4 ? 'text-green-600' : 'text-gray-600'}`}>{getStrengthLabel()}</span>
            </div>
            <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden flex gap-1">
                {[1, 2, 3, 4].map(level => (
                    <div key={level} className={`h-full flex-1 transition-all duration-300 ${level <= strength ? getStrengthColor() : 'bg-transparent'}`}></div>
                ))}
            </div>
        </div>
    );
};

const FaceScanner = ({ currentUser, subjects, onAttendanceMarked }) => {
    const webcamRef = React.useRef(null);
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [status, setStatus] = useState('Initializing models...');
    const [selectedSubject, setSelectedSubject] = useState('');

    useEffect(() => {
        const loadModels = async () => {
            try {
                await Promise.all([
                    faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
                    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
                    faceapi.nets.faceRecognitionNet.loadFromUri('/models')
                ]);
                setModelsLoaded(true);
                setStatus('Ready. Please look at the camera.');
            } catch (err) {
                setStatus('Error loading models.');
            }
        };
        loadModels();
    }, []);

    const captureAndDetect = async () => {
        if (!webcamRef.current) return null;
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return null;

        const img = await faceapi.fetchImage(imageSrc);
        const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
        return detection ? Array.from(detection.descriptor) : null;
    };

    const handleEnroll = async () => {
        setStatus('Scanning face...');
        const descriptor = await captureAndDetect();
        if (!descriptor) {
            setStatus('No face detected. Try again.');
            return;
        }

        setStatus('Face detected! Enrolling...');
        try {
            const res = await fetch('http://localhost:5000/api/face/enroll', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUser.id, faceDescriptor: descriptor })
            });
            const data = await res.json();
            if (res.ok) {
                setStatus('Enrollment successful!');
            } else {
                setStatus('Enrollment failed.');
            }
        } catch (err) {
            setStatus('Server error.');
        }
    };

    const handleMarkAttendance = async () => {
        if (!selectedSubject) {
            setStatus('Please select a subject first.');
            return;
        }
        setStatus('Scanning face for attendance...');
        const descriptor = await captureAndDetect();
        if (!descriptor) {
            setStatus('No face detected. Try again.');
            return;
        }

        try {
            const resDesc = await fetch(`http://localhost:5000/api/face/descriptor/${currentUser.id}`);
            const dataDesc = await resDesc.json();
            if (!resDesc.ok) {
                setStatus('You must enroll your face first.');
                return;
            }

            const savedDescriptor = new Float32Array(dataDesc.descriptor);
            const currentDescriptor = new Float32Array(descriptor);
            
            const distance = faceapi.euclideanDistance(savedDescriptor, currentDescriptor);
            
            if (distance < 0.6) {
                setStatus('Face matched! Marking attendance...');
                const today = new Date().toISOString().split('T')[0];
                const res = await fetch('http://localhost:5000/api/student/mark-attendance', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUser.id, name: currentUser.name, date: today, subjectId: selectedSubject })
                });
                if (res.ok) {
                    setStatus('Attendance Marked Present!');
                    if (onAttendanceMarked) onAttendanceMarked();
                }
            } else {
                setStatus('Face did not match.');
            }
        } catch (err) {
            setStatus('Error verifying face.');
        }
    };

    return (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center">
            <h3 className="text-xl font-black text-gray-900 mb-4">Face Attendance Kiosk</h3>
            <div className="w-full max-w-sm mb-4">
                <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="w-full p-3 border border-gray-200 rounded-xl outline-none bg-gray-50 text-sm font-medium focus:ring-2 focus:ring-indigo-500 transition">
                    <option value="">Select Subject for Attendance...</option>
                    {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>)}
                </select>
            </div>
            <div className="relative w-full max-w-sm rounded-xl overflow-hidden shadow-inner bg-gray-900 aspect-video flex items-center justify-center">
                {modelsLoaded ? (
                    <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        className="w-full h-full object-cover"
                    />
                ) : (
                    <div className="text-white text-sm animate-pulse">Loading ML Models...</div>
                )}
                {/* Scanner Reticle Overlay */}
                <div className="absolute inset-0 pointer-events-none border-4 border-indigo-500/30 m-4 rounded-lg">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-indigo-500 rounded-tl-sm"></div>
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-indigo-500 rounded-tr-sm"></div>
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-indigo-500 rounded-bl-sm"></div>
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-indigo-500 rounded-br-sm"></div>
                </div>
            </div>
            <div className="mt-4 text-center text-sm font-medium text-indigo-600 h-6 bg-indigo-50 px-4 py-1 rounded-full">{status}</div>
            <div className="mt-6 flex gap-4 w-full max-w-sm">
                <button disabled={!modelsLoaded} onClick={handleEnroll} className="flex-1 py-3 bg-indigo-50 text-indigo-700 font-bold rounded-xl hover:bg-indigo-100 transition disabled:opacity-50 text-sm">Register Face</button>
                <button disabled={!modelsLoaded} onClick={handleMarkAttendance} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 text-sm shadow-lg shadow-indigo-200 hover:-translate-y-0.5">Scan & Mark</button>
            </div>
        </div>
    );
};

export default function App() {
    const [currentUser, setCurrentUser] = useState(null);
    const [view, setView] = useState('login'); // 'login', 'register', 'dashboard'
    const [studentView, setStudentView] = useState('overview');

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [name, setName] = useState('');
    const [dob, setDob] = useState('');
    const [previousInstitution, setPreviousInstitution] = useState('');
    const [previousCompany, setPreviousCompany] = useState('');
    const [role, setRole] = useState('student');
    const [gender, setGender] = useState('');
    const [accommodationMode, setAccommodationMode] = useState('');
    const [newCourseAllotted, setNewCourseAllotted] = useState('');
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');

    const [resetEmail, setResetEmail] = useState('');
    const [resetOtp, setResetOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');

    // Admin State
    const [users, setUsers] = useState([]);

    // Faculty State
    const [attendance, setAttendance] = useState([]);
    const [submissions, setSubmissions] = useState([]);

    // Staff / Shared State
    const [regularStaffStudents, setRegularStaffStudents] = useState([]);
    const [financialStaffStudents, setFinancialStaffStudents] = useState([]);
    const [fees, setFees] = useState([]);
    const [transcripts, setTranscripts] = useState([]);
    const [subjects, setSubjects] = useState([]);
    
    // Faculty Attendance State
    const [approvedStudents, setApprovedStudents] = useState([]);
    const [classAttendance, setClassAttendance] = useState([]);
    const [attendanceDate, setAttendanceDate] = useState('');
    const [attendanceSubjectId, setAttendanceSubjectId] = useState('');

    // Faculty Enhanced State
    const [facultyView, setFacultyView] = useState('attendance');
    const [schedules, setSchedules] = useState([]);
    const [scheduleForm, setScheduleForm] = useState({
        subjectId: '', date: '', time: '', room: '', type: 'Lecture'
    });

    // Student Form State
    const [formData, setFormData] = useState({
        subjectId: '',
        assignmentType: 'Reflective Journal 1',
        textContent: ''
    });
    const [file, setFile] = useState(null);

    // Enhanced Student State
    const [clock, setClock] = useState(new Date());
    const [qrPaymentActive, setQrPaymentActive] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    
    // Transcript Form State
    const [transcriptStudentInfo, setTranscriptStudentInfo] = useState(null);
    const [transcriptMarksForm, setTranscriptMarksForm] = useState([
        { subjectName: 'React Js', marks: '', credits: '' },
        { subjectName: 'Node Js', marks: '', credits: '' },
        { subjectName: 'Python', marks: '', credits: '' },
        { subjectName: 'DBMS', marks: '', credits: '' },
        { subjectName: 'Skill Achievement', marks: '', credits: '' }
    ]);
    const [searchRollNumber, setSearchRollNumber] = useState('');
    
    // AI Interview State
    const [aiInterviewActive, setAiInterviewActive] = useState(false);
    const [aiInterviewTranscript, setAiInterviewTranscript] = useState('');
    const [aiQuestion, setAiQuestion] = useState('Welcome to your mock interview. Are you ready to begin?');
    const [aiInterviewStage, setAiInterviewStage] = useState('start');

    useEffect(() => {
        const timer = setInterval(() => setClock(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.altKey && currentUser && currentUser.role === 'student') {
                const views = ['overview', 'attendance', 'academics', 'assignments', 'exams', 'fees', 'syllabus', 'profile', 'ai-interview'];
                const currentIndex = views.indexOf(studentView);
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    if (currentIndex > 0) setStudentView(views[currentIndex - 1]);
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    if (currentIndex < views.length - 1) setStudentView(views[currentIndex + 1]);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [studentView, currentUser]);

    useEffect(() => {
        if (currentUser) {
            if (currentUser.role === 'admin') {
                fetchUsers();
                fetchSubjects();
            }
            if (currentUser.role === 'faculty') fetchFacultyData();
            if (currentUser.role === 'financial_staff') fetchFinancialStaffData();
            if (currentUser.role === 'regular_staff') fetchRegularStaffData();
            if (currentUser.role === 'student') {
                fetchStudentData();
                fetchSubjects();
                fetchStudentAttendance();
            }
        }
    }, [currentUser]);

    useEffect(() => {
        if (currentUser && currentUser.role === 'faculty' && attendanceDate && attendanceSubjectId) {
            fetchClassAttendance(attendanceDate, attendanceSubjectId);
        }
    }, [attendanceDate, attendanceSubjectId]);

    const fetchClassAttendance = async (date, subjectId) => {
        try {
            const res = await fetch(`http://localhost:5000/api/class_attendance?date=${date}&subjectId=${subjectId}`);
            setClassAttendance(await res.json());
        } catch (err) { console.error(err); }
    };

    const fetchFinancialStaffData = async () => {
        try {
            const stuRes = await fetch('http://localhost:5000/api/staff/students');
            setFinancialStaffStudents(await stuRes.json());
            const feeRes = await fetch('http://localhost:5000/api/fees');
            setFees(await feeRes.json());
        } catch (err) { console.error(err); }
    };

    const fetchRegularStaffData = async () => {
        try {
            const stuRes = await fetch('http://localhost:5000/api/staff/students');
            setRegularStaffStudents(await stuRes.json());
            const transRes = await fetch('http://localhost:5000/api/transcripts');
            setTranscripts(await transRes.json());
            const subjRes = await fetch('http://localhost:5000/api/subjects');
            setSubjects(await subjRes.json());
        } catch (err) { console.error(err); }
    };

    const fetchStudentData = async () => {
        try {
            const feeRes = await fetch('http://localhost:5000/api/fees');
            const allFees = await feeRes.json();
            setFees(allFees.filter(f => f.userId === currentUser.id));

            const transRes = await fetch('http://localhost:5000/api/transcripts');
            const allTrans = await transRes.json();
            setTranscripts(allTrans.filter(t => t.userId === currentUser.id));
        } catch (err) { console.error(err); }
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/admin/users');
            setUsers(await res.json());
        } catch (err) { console.error(err); }
    };

    const fetchFacultyData = async () => {
        try {
            // Fetch submissions from correct endpoint
            const resSub = await fetch('http://localhost:5000/api/submissions');
            if (resSub.ok) {
                const dataSub = await resSub.json();
                setSubmissions(dataSub);
            }
            
            const resAppr = await fetch('http://localhost:5000/api/approved_students');
            if (resAppr.ok) {
                const dataAppr = await resAppr.json();
                setApprovedStudents(dataAppr);
            }

            const resSched = await fetch('http://localhost:5000/api/schedules');
            if (resSched.ok) {
                const dataSched = await resSched.json();
                setSchedules(dataSched);
            }
            
            fetchSubjects();
        } catch (err) {
            console.error("Failed to fetch faculty data", err);
        }
    };

    const fetchStudentAttendance = async () => {
        if (!currentUser) return;
        try {
            const res = await fetch(`http://localhost:5000/api/class_attendance?userId=${currentUser.id}`);
            const data = await res.json();
            setClassAttendance(data);
        } catch (err) {
            console.error("Failed to fetch student attendance", err);
        }
    };

    const fetchSubjects = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/subjects');
            setSubjects(await res.json());
        } catch (err) {
            console.error("Failed to fetch subjects", err);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError(''); setMessage('');
        try {
            const res = await fetch('http://localhost:5000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (res.ok) {
                setCurrentUser(data.user);
                setView('dashboard');
                setEmail(''); setPassword('');
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Failed to connect to server.');
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError(''); setMessage('');
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])(?=.{8,})/.test(password)) {
            setError('Password must be at least 8 characters long and contain an uppercase letter, a lowercase letter, a number, and a special character.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        try {
            const res = await fetch('http://localhost:5000/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password, role, dob, previousInstitution, previousCompany, gender, accommodationMode, newCourseAllotted })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage(data.message);
                setView('login');
                setName(''); setEmail(''); setPassword(''); setConfirmPassword('');
                setDob(''); setPreviousInstitution(''); setPreviousCompany(''); setRole('student');
                setGender(''); setAccommodationMode(''); setNewCourseAllotted('');
            } else {
                setError(data.error);
            }
        } catch (err) {
            setError('Failed to connect to server.');
        }
    };

    const handleSendOtp = async (e) => {
        e.preventDefault();
        setError(''); setMessage('');
        try {
            const res = await fetch('http://localhost:5000/api/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: resetEmail })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage(data.message);
                setView('forgot-otp');
            } else {
                setError(data.error);
            }
        } catch (err) { setError('Failed to connect to server.'); }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError(''); setMessage('');
        try {
            const res = await fetch('http://localhost:5000/api/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: resetEmail, otp: resetOtp })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage(data.message);
                setView('forgot-new-password');
            } else {
                setError(data.error);
            }
        } catch (err) { setError('Failed to connect to server.'); }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError(''); setMessage('');
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9])(?=.{8,})/.test(newPassword)) {
            setError('Password must be at least 8 characters long and contain an uppercase letter, a lowercase letter, a number, and a special character.');
            return;
        }
        try {
            const res = await fetch('http://localhost:5000/api/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: resetEmail, otp: resetOtp, newPassword })
            });
            const data = await res.json();
            if (res.ok) {
                setMessage(data.message);
                setView('login');
                setResetEmail(''); setResetOtp(''); setNewPassword('');
            } else {
                setError(data.error);
            }
        } catch (err) { setError('Failed to connect to server.'); }
    };

    const handleApprove = async (id) => {
        try {
            await fetch('http://localhost:5000/api/admin/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            if (currentUser.role === 'admin') fetchUsers();
            if (currentUser.role === 'financial_staff') fetchFinancialStaffData();
            if (currentUser.role === 'regular_staff') fetchRegularStaffData();
        } catch (err) {
            console.error(err);
        }
    };

    const handleGeneratePassword = async (id, type) => {
        try {
            const res = await fetch('http://localhost:5000/api/admin/generate-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, type })
            });
            const data = await res.json();
            if (res.ok) {
                alert(`New Password: ${data.newPassword}`);
                fetchUsers();
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleRoleChange = async (id, newRole) => {
        try {
            await fetch('http://localhost:5000/api/admin/role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, role: newRole })
            });
            fetchUsers();
        } catch (err) {
            console.error(err);
        }
    };

    const handleFeeUpdate = async (userId, amountDue, amountPaid, status) => {
        await fetch('http://localhost:5000/api/fees/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, amountDue, amountPaid, status })
        });
        alert('Fees updated!');
        fetchFinancialStaffData();
    };

    const handleTranscriptUpdate = async (userId, gpa, details) => {
        await fetch('http://localhost:5000/api/transcripts/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, gpa, details })
        });
        alert('Transcript updated!');
        fetchRegularStaffData();
    };

    const handleSubjectAdd = async (e) => {
        e.preventDefault();
        const name = e.target.subjectName.value;
        const code = e.target.subjectCode.value;
        await fetch('http://localhost:5000/api/subjects/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, code })
        });
        e.target.reset();
        fetchRegularStaffData();
    };

    const downloadTranscriptPDF = (studentInfo, marksData) => {
        const doc = new jsPDF();
        
        // Header
        doc.setFontSize(20);
        doc.setFont("helvetica", "bold");
        doc.text("Bhagat Singh Institute of Technology", 105, 20, { align: "center" });
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("444-561 Vivekananda Street, Financial District, 500065", 105, 28, { align: "center" });
        doc.text("Email: bhxxxxxxxxxit@edu.in", 105, 34, { align: "center" });
        
        doc.setLineWidth(0.5);
        doc.line(20, 40, 190, 40);

        // Student Info
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Student Details:", 20, 50);
        doc.setFont("helvetica", "normal");
        doc.text(`Name: ${studentInfo.name}`, 20, 60);
        doc.text(`Roll Number: ${studentInfo.rollNumber}`, 20, 68);
        doc.text(`Phone Number: ${studentInfo.phoneNumber || 'N/A'}`, 20, 76);
        doc.text(`Department: ${studentInfo.department}`, 120, 60);
        doc.text(`Branch: CS`, 120, 68);
        doc.text(`Class/Section: ${studentInfo.section}`, 120, 76);
        doc.text(`Year of Study/Sem: ${studentInfo.semester}`, 20, 84);

        // Table Data
        const tableColumn = ["Subject", "Credits", "Marks"];
        const tableRows = [];
        let totalMarks = 0;

        marksData.forEach(m => {
            const marksVal = parseFloat(m.marks) || 0;
            totalMarks += marksVal;
            tableRows.push([m.subjectName, m.credits, m.marks]);
        });
        
        tableRows.push([{content: 'Total Marks', styles: {fontStyle: 'bold'}}, '', {content: totalMarks.toString(), styles: {fontStyle: 'bold'}}]);

        doc.autoTable({
            startY: 95,
            head: [tableColumn],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
        });

        doc.save(`${studentInfo.rollNumber}_Transcript.pdf`);
    };

    const handleTranscriptSearch = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`http://localhost:5000/api/transcripts/student/${searchRollNumber}`);
            if (res.ok) {
                const data = await res.json();
                setTranscriptStudentInfo(data);
            } else {
                alert('Student not found');
                setTranscriptStudentInfo(null);
            }
        } catch (err) { console.error(err); }
    };

    const handleSaveTranscriptMarks = async () => {
        if (!transcriptStudentInfo) return;
        try {
            const res = await fetch('http://localhost:5000/api/transcripts/marks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: transcriptStudentInfo.id, marksData: transcriptMarksForm })
            });
            if (res.ok) alert('Marks saved successfully!');
        } catch (err) { console.error(err); }
    };

    const handleAddSchedule = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch('http://localhost:5000/api/schedules/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(scheduleForm)
            });
            if (res.ok) {
                alert('Schedule added successfully');
                setScheduleForm({ subjectId: '', date: '', time: '', room: '', type: 'Lecture' });
                fetchFacultyData();
            }
        } catch (err) { console.error(err); }
    };

    const handleDeleteSchedule = async (id) => {
        if (!window.confirm('Delete this schedule?')) return;
        try {
            const res = await fetch('http://localhost:5000/api/schedules/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            if (res.ok) {
                fetchFacultyData();
            }
        } catch (err) { console.error(err); }
    };

    const handleStudentSubmit = async (e) => {
        e.preventDefault();
        const data = new FormData();
        data.append('userId', currentUser.id);
        data.append('studentName', currentUser.name);
        data.append('subjectId', formData.subjectId);
        data.append('assignmentType', formData.assignmentType);
        data.append('textContent', formData.textContent);
        if (file) data.append('projectFile', file);

        try {
            const res = await fetch('http://localhost:5000/api/submit', {
                method: 'POST',
                body: data
            });
            if (res.ok) {
                alert('Submission sent successfully!');
                setFormData({ ...formData, textContent: '' });
                setFile(null);
                e.target.reset();
            }
        } catch (err) {
            alert('Submission failed.');
        }
    };

    const handleAttendanceChange = async (userId, name, status) => {
        if (!attendanceDate || !attendanceSubjectId) return alert("Select Date and Subject first");
        await fetch('http://localhost:5000/api/class_attendance/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, name, date: attendanceDate, subjectId: attendanceSubjectId, status })
        });
        fetchClassAttendance(attendanceDate, attendanceSubjectId);
    };

    const handleGradeSubmit = async (id, marks, feedback) => {
        await fetch('http://localhost:5000/api/grade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, marks, feedback })
        });
        alert('Grades saved!');
        fetchFacultyData();
    };

    const logout = () => {
        setCurrentUser(null);
        setView('login');
    };



    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 text-gray-800 font-sans selection:bg-indigo-200">
            {/* Header */}
            <nav className="bg-white/70 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">E</div>
                            <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 tracking-tight">EduPortal Core</h1>
                        </div>
                        {currentUser && (
                            <div className="flex items-center space-x-6">
                                <span className="text-sm font-medium text-gray-600">
                                    Welcome, <strong className="text-gray-900">{currentUser.name}</strong>
                                    <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-700 uppercase tracking-wider">{currentUser.role}</span>
                                </span>
                                <button onClick={logout} className="text-sm font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 px-4 py-2 rounded-lg transition">Logout</button>
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                {/* Error/Message Banners */}
                {error && <div className="max-w-md mx-auto mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg shadow-sm">
                    <p className="text-red-700 font-medium text-sm">{error}</p>
                </div>}
                {message && <div className="max-w-md mx-auto mb-6 bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg shadow-sm">
                    <p className="text-green-700 font-medium text-sm">{message}</p>
                </div>}

                {/* Login View */}
                {view === 'login' && !currentUser && (
                    <div className="max-w-md mx-auto">
                        <div className="bg-white/60 backdrop-blur-xl p-8 rounded-3xl shadow-xl border border-white/50 relative overflow-hidden">
                            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-indigo-400 opacity-20 blur-2xl"></div>
                            <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-32 h-32 rounded-full bg-purple-400 opacity-20 blur-2xl"></div>

                            <h2 className="text-3xl font-black text-gray-900 mb-2 relative">Welcome Back</h2>
                            <p className="text-gray-500 text-sm mb-8 relative">Please sign in to access your dashboard.</p>

                            <form onSubmit={handleLogin} className="relative">
                                <InputField label="Email Address" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@edu.com" />
                                <InputField label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                                <p className="text-[11px] text-gray-500 mt-1">
                                    * Uploaded students: your password is your Roll Number (e.g., EDU12345).
                                </p>
                                <button type="submit" className="w-full mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 transition-all duration-200">
                                    Sign In
                                </button>
                            </form>

                            <div className="mt-6 flex justify-between text-sm text-gray-600 relative">
                                <button type="button" onClick={() => { setView('forgot-email'); setError(''); setMessage(''); setResetEmail(''); }} className="font-bold text-indigo-600 hover:text-indigo-500 hover:underline">Forgot Password?</button>
                                <span>Don't have an account? <button type="button" onClick={() => { setView('register'); setError(''); setMessage(''); setConfirmPassword(''); }} className="font-bold text-indigo-600 hover:text-indigo-500 hover:underline">Register</button></span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Register View */}
                {view === 'register' && !currentUser && (
                    <div className="max-w-md mx-auto">
                        <div className="bg-white/60 backdrop-blur-xl p-8 rounded-3xl shadow-xl border border-white/50 relative overflow-hidden">
                            <div className="absolute top-0 left-0 -ml-8 -mt-8 w-32 h-32 rounded-full bg-purple-400 opacity-20 blur-2xl"></div>

                            <h2 className="text-3xl font-black text-gray-900 mb-2 relative">Create Account</h2>
                            <p className="text-gray-500 text-sm mb-8 relative">Student accounts require admin approval.</p>

                            <form onSubmit={handleRegister} className="relative">
                                <InputField label="Full Name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="John Doe" />
                                <InputField label="Email Address" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@edu.com" />
                                <InputField label="Date of Birth" type="date" value={dob} onChange={e => setDob(e.target.value)} />
                                <div className="mb-4 flex gap-4">
                                    <div className="flex-1">
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Gender</label>
                                        <select value={gender} onChange={e => setGender(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white/50 focus:ring-2 focus:ring-indigo-500 outline-none">
                                            <option value="">Select...</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Role</label>
                                        <select value={role} onChange={e => setRole(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white/50 focus:ring-2 focus:ring-indigo-500 outline-none">
                                            <option value="student">Student</option>
                                            <option value="faculty">Faculty</option>
                                            <option value="regular_staff">Regular Staff</option>
                                            <option value="financial_staff">Financial Staff</option>
                                        </select>
                                    </div>
                                </div>
                                <InputField label="Previous School/College" type="text" value={previousInstitution} onChange={e => setPreviousInstitution(e.target.value)} placeholder="XYZ High School" required={false} />
                                <InputField label="Previous Company (if any)" type="text" value={previousCompany} onChange={e => setPreviousCompany(e.target.value)} placeholder="ABC Corp" required={false} />
                                <div className="mb-4 flex gap-4">
                                    <div className="flex-1">
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Accommodation Mode</label>
                                        <select value={accommodationMode} onChange={e => setAccommodationMode(e.target.value)} className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white/50 focus:ring-2 focus:ring-indigo-500 outline-none">
                                            <option value="">Select...</option>
                                            <option value="Hostel">Hostel</option>
                                            <option value="Day Scholar">Day Scholar</option>
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <InputField label="New Course Allotted" type="text" value={newCourseAllotted} onChange={e => setNewCourseAllotted(e.target.value)} placeholder="B.Tech CS" required={false} />
                                    </div>
                                </div>
                                <InputField label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
                                {password.length > 0 && <PasswordStrengthMeter password={password} />}
                                <InputField label="Confirm Password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" />
                                <button type="submit" className="w-full mt-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-purple-200 hover:shadow-purple-300 hover:-translate-y-0.5 transition-all duration-200">
                                    Submit Registration
                                </button>
                            </form>

                            <p className="mt-6 text-center text-sm text-gray-600 relative">
                                Already registered? <button onClick={() => { setView('login'); setError(''); setMessage(''); setConfirmPassword(''); }} className="font-bold text-indigo-600 hover:text-indigo-500 hover:underline">Sign In</button>
                            </p>
                        </div>
                    </div>
                )}

                {/* Forgot Password - Email View */}
                {view === 'forgot-email' && !currentUser && (
                    <div className="max-w-md mx-auto">
                        <div className="bg-white/60 backdrop-blur-xl p-8 rounded-3xl shadow-xl border border-white/50 relative overflow-hidden">
                            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-blue-400 opacity-20 blur-2xl"></div>
                            <h2 className="text-2xl font-black text-gray-900 mb-2 relative">Reset Password</h2>
                            <p className="text-gray-500 text-sm mb-6 relative">Enter your email to receive an OTP.</p>
                            <form onSubmit={handleSendOtp} className="relative">
                                <InputField label="Email Address" type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="name@edu.com" />
                                <button type="submit" className="w-full mt-2 bg-indigo-600 text-white py-3.5 rounded-xl font-bold shadow-lg hover:-translate-y-0.5 transition-all duration-200">Send OTP</button>
                            </form>
                            <p className="mt-6 text-center text-sm text-gray-600 relative">
                                Remembered your password? <button onClick={() => { setView('login'); setError(''); setMessage(''); }} className="font-bold text-indigo-600 hover:underline">Sign In</button>
                            </p>
                        </div>
                    </div>
                )}

                {/* Forgot Password - OTP View */}
                {view === 'forgot-otp' && !currentUser && (
                    <div className="max-w-md mx-auto">
                        <div className="bg-white/60 backdrop-blur-xl p-8 rounded-3xl shadow-xl border border-white/50 relative overflow-hidden">
                            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-blue-400 opacity-20 blur-2xl"></div>
                            <h2 className="text-2xl font-black text-gray-900 mb-2 relative">Enter OTP</h2>
                            <p className="text-gray-500 text-sm mb-6 relative">Check your email ({resetEmail}) for the 6-digit code.</p>
                            <form onSubmit={handleVerifyOtp} className="relative">
                                <InputField label="OTP Code" type="text" value={resetOtp} onChange={e => setResetOtp(e.target.value)} placeholder="123456" />
                                <button type="submit" className="w-full mt-2 bg-indigo-600 text-white py-3.5 rounded-xl font-bold shadow-lg hover:-translate-y-0.5 transition-all duration-200">Verify OTP</button>
                            </form>
                            <p className="mt-6 text-center text-sm text-gray-600 relative">
                                Didn't receive the code? <button type="button" onClick={handleSendOtp} className="font-bold text-indigo-600 hover:underline">Resend OTP</button>
                            </p>
                        </div>
                    </div>
                )}

                {/* Forgot Password - New Password View */}
                {view === 'forgot-new-password' && !currentUser && (
                    <div className="max-w-md mx-auto">
                        <div className="bg-white/60 backdrop-blur-xl p-8 rounded-3xl shadow-xl border border-white/50 relative overflow-hidden">
                            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-blue-400 opacity-20 blur-2xl"></div>
                            <h2 className="text-2xl font-black text-gray-900 mb-2 relative">New Password</h2>
                            <p className="text-gray-500 text-sm mb-6 relative">Set a strong new password.</p>
                            <form onSubmit={handleResetPassword} className="relative">
                                <InputField label="New Password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" />
                                {newPassword.length > 0 && <PasswordStrengthMeter password={newPassword} />}
                                <button type="submit" className="w-full mt-2 bg-green-600 text-white py-3.5 rounded-xl font-bold shadow-lg hover:-translate-y-0.5 transition-all duration-200">Reset & Login</button>
                            </form>
                        </div>
                    </div>
                )}

                {/* --- DASHBOARDS --- */}
                {view === 'dashboard' && currentUser && (
                    <div className="animate-fade-in-up">
                        {/* STUDENT DASHBOARD WITH SIDEBAR */}
                        {currentUser.role === 'student' && (
                            <div className="flex flex-col md:flex-row gap-8 max-w-7xl mx-auto">
                                {/* Sidebar */}
                                <div className="w-full md:w-64 flex-shrink-0">
                                    <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col gap-2">
                                        <button onClick={() => setStudentView('overview')} className={`text-left px-4 py-3 rounded-xl font-bold transition ${studentView === 'overview' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>Dashboard Overview</button>
                                        <button onClick={() => setStudentView('attendance')} className={`text-left px-4 py-3 rounded-xl font-bold transition ${studentView === 'attendance' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>Face Attendance</button>
                                        <button onClick={() => setStudentView('academics')} className={`text-left px-4 py-3 rounded-xl font-bold transition ${studentView === 'academics' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>Academic Details</button>
                                        <button onClick={() => setStudentView('assignments')} className={`text-left px-4 py-3 rounded-xl font-bold transition ${studentView === 'assignments' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>Assignments</button>
                                        <button onClick={() => setStudentView('exams')} className={`text-left px-4 py-3 rounded-xl font-bold transition ${studentView === 'exams' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>Exams Schedule</button>
                                        <button onClick={() => setStudentView('fees')} className={`text-left px-4 py-3 rounded-xl font-bold transition ${studentView === 'fees' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>Fees & Financial</button>
                                        <button onClick={() => setStudentView('syllabus')} className={`text-left px-4 py-3 rounded-xl font-bold transition ${studentView === 'syllabus' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>Syllabus</button>
                                        <button onClick={() => setStudentView('profile')} className={`text-left px-4 py-3 rounded-xl font-bold transition ${studentView === 'profile' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}>My Profile</button>
                                        <div className="my-2 border-t border-gray-100"></div>
                                        <button onClick={() => setStudentView('ai-interview')} className={`text-left px-4 py-3 rounded-xl font-bold transition flex items-center justify-between ${studentView === 'ai-interview' ? 'bg-indigo-600 text-white shadow-md' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'}`}>
                                            AI Interview
                                            <span className="flex h-2 w-2">
                                              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-indigo-400 opacity-75"></span>
                                              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                                            </span>
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Main Content Area */}
                                <div className="flex-1">
                                    {studentView === 'overview' && (
                                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 animate-fade-in-up">
                                            <div className="flex justify-between items-start mb-6">
                                                <div>
                                                    <h2 className="text-2xl font-black text-gray-900">Welcome to your Portal!</h2>
                                                    <p className="text-gray-600 mt-1">Select a tab from the left to manage your academic profile.</p>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-3xl font-black text-indigo-600 tracking-tight">{clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                                                    <div className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">{clock.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</div>
                                                </div>
                                            </div>
                                            
                                            <div className="grid md:grid-cols-2 gap-4 mb-8">
                                                <div className="p-6 bg-indigo-50 rounded-2xl">
                                                    <h4 className="font-bold text-indigo-900 mb-2">Next Exam</h4>
                                                    <p className="text-indigo-700 text-sm">React.js (CS101) - In 3 days</p>
                                                </div>
                                                <div className="p-6 bg-green-50 rounded-2xl">
                                                    <h4 className="font-bold text-green-900 mb-2">GPA Standing</h4>
                                                    <p className="text-green-700 text-sm font-black text-xl">{transcripts.length > 0 ? transcripts[0].gpa : 'N/A'}</p>
                                                </div>
                                            </div>

                                            <div className="grid md:grid-cols-2 gap-8">
                                                <div>
                                                    <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2"><svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg> Today's Schedule</h3>
                                                    <div className="space-y-3">
                                                        <div className="flex gap-4 items-center p-3 rounded-xl bg-gray-50 border border-gray-100">
                                                            <div className="text-xs font-bold text-gray-500 w-16 text-right">09:00 AM</div>
                                                            <div className="w-1 h-8 bg-indigo-500 rounded-full"></div>
                                                            <div>
                                                                <div className="font-bold text-gray-900 text-sm">React.js Lecture</div>
                                                                <div className="text-xs text-gray-500">Room 304</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-4 items-center p-3 rounded-xl bg-gray-50 border border-gray-100">
                                                            <div className="text-xs font-bold text-gray-500 w-16 text-right">11:30 AM</div>
                                                            <div className="w-1 h-8 bg-green-500 rounded-full"></div>
                                                            <div>
                                                                <div className="font-bold text-gray-900 text-sm">Node.js Lab</div>
                                                                <div className="text-xs text-gray-500">Computer Lab 2</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2"><svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"></path></svg> Faculty Events & Announcements</h3>
                                                    <div className="space-y-3">
                                                        <div className="p-4 rounded-xl bg-orange-50 border border-orange-100">
                                                            <div className="flex justify-between items-start mb-1">
                                                                <div className="font-bold text-orange-900 text-sm">Guest Lecture: The Future of AI</div>
                                                                <span className="px-2 py-0.5 bg-orange-200 text-orange-800 text-[10px] font-black uppercase tracking-wider rounded">Today, 2 PM</span>
                                                            </div>
                                                            <div className="text-xs text-orange-700">Join Prof. Turing in the Main Auditorium for an exclusive talk on Large Language Models.</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {studentView === 'attendance' && (
                                        <div className="animate-fade-in-up">
                                            <FaceScanner currentUser={currentUser} subjects={subjects} onAttendanceMarked={fetchStudentAttendance} />
                                        </div>
                                    )}

                                    {studentView === 'academics' && (
                                        <div className="space-y-6 animate-fade-in-up">
                                            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                                                <div className="flex justify-between items-center mb-6">
                                                    <h2 className="text-2xl font-black text-gray-900">Attendance Analytics</h2>
                                                    <button onClick={() => {
                                                        const doc = new jsPDF();
                                                        doc.text(`${currentUser.name} - Attendance Report`, 10, 10);
                                                        classAttendance.forEach((record, i) => {
                                                            const subjectName = subjects.find(s => s.id === record.subjectId)?.name || 'Unknown';
                                                            doc.text(`${record.date} | ${subjectName} | ${record.status}`, 10, 20 + (i * 10));
                                                        });
                                                        doc.save('Attendance_Report.pdf');
                                                    }} className="px-4 py-2 bg-indigo-50 text-indigo-700 font-bold rounded-lg hover:bg-indigo-100 text-sm transition">Download Report PDF</button>
                                                </div>
                                                
                                                <div className="grid md:grid-cols-3 gap-4 mb-6">
                                                    <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-center">
                                                        <div className="text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">Total Classes</div>
                                                        <div className="text-2xl font-black text-gray-900">{classAttendance.length}</div>
                                                    </div>
                                                    <div className="p-4 bg-green-50 rounded-xl border border-green-100 text-center">
                                                        <div className="text-green-600 text-xs font-bold uppercase tracking-wider mb-1">Total Present</div>
                                                        <div className="text-2xl font-black text-gray-900">{classAttendance.filter(a => a.status === 'Present').length}</div>
                                                    </div>
                                                    <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 text-center">
                                                        <div className="text-purple-600 text-xs font-bold uppercase tracking-wider mb-1">Attendance %</div>
                                                        <div className="text-2xl font-black text-gray-900">
                                                            {classAttendance.length > 0 ? Math.round((classAttendance.filter(a => a.status === 'Present').length / classAttendance.length) * 100) : 0}%
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    {subjects.map(sub => {
                                                        const subAtt = classAttendance.filter(a => a.subjectId === sub.id);
                                                        if (subAtt.length === 0) return null;
                                                        const present = subAtt.filter(a => a.status === 'Present').length;
                                                        const absent = subAtt.length - present;
                                                        return (
                                                            <div key={sub.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                                                                <span className="font-bold text-gray-700 text-sm">{sub.name}</span>
                                                                <div className="flex gap-4 text-sm">
                                                                    <span className="text-green-600 font-bold">{present} Present</span>
                                                                    <span className="text-red-500 font-bold">{absent} Absent</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                                                <h2 className="text-2xl font-black text-gray-900 mb-6">Academic Transcript</h2>
                                                {transcripts.length > 0 ? (
                                                    <div className="space-y-4">
                                                        <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
                                                            <span className="text-gray-500 font-bold uppercase tracking-wider text-xs">Cumulative GPA</span>
                                                            <span className="font-black text-indigo-600 text-2xl">{transcripts[0].gpa || 'N/A'}</span>
                                                        </div>
                                                        <div className="p-4 bg-gray-50 rounded-xl text-gray-600 font-mono text-sm whitespace-pre-wrap leading-relaxed border-l-4 border-indigo-500">
                                                            {transcripts[0].details || 'No additional details provided by staff.'}
                                                        </div>
                                                        <button onClick={() => downloadTranscriptPDF(currentUser.name, transcripts[0])} className="mt-4 w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 hover:-translate-y-0.5 transition flex items-center justify-center gap-2">
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                                            Download Official PDF Transcript
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                                        <p className="text-gray-500">Your transcript has not been published yet.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {studentView === 'assignments' && (
                                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden animate-fade-in-up">
                                            <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-50 rounded-bl-full -z-10 opacity-50"></div>
                                            <h2 className="text-2xl font-black text-gray-900 mb-6">Assignment Terminal</h2>
                                            <form onSubmit={handleStudentSubmit} className="space-y-5 relative z-10">
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Target Subject</label>
                                                    <select required value={formData.subjectId} onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium text-sm">
                                                        <option value="">Select Subject...</option>
                                                        {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>)}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Submission Category</label>
                                                    <select value={formData.assignmentType} onChange={(e) => setFormData({ ...formData, assignmentType: e.target.value })} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium text-sm">
                                                        <optgroup label="Reflective Journals">
                                                            {[...Array(10)].map((_, i) => <option key={`j${i}`} value={`Reflective Journal ${i + 1}`}>Reflective Journal {i + 1}</option>)}
                                                        </optgroup>
                                                        <optgroup label="Reflective Lab Journals">
                                                            {[...Array(10)].map((_, i) => <option key={`l${i}`} value={`Reflective Lab Journal ${i + 1}`}>Reflective Lab Journal {i + 1}</option>)}
                                                        </optgroup>
                                                        <optgroup label="Core Assignments">
                                                            <option value="Assignment 1">Assignment 1</option>
                                                            <option value="Assignment 2">Assignment 2</option>
                                                            <option value="Case Study">Case Study</option>
                                                            <option value="Group Assignment">Group Assignment</option>
                                                            <option value="Project Report">Project Report</option>
                                                        </optgroup>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Content</label>
                                                    <textarea rows="6" value={formData.textContent} onChange={(e) => setFormData({ ...formData, textContent: e.target.value })} className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white resize-y font-mono text-sm" placeholder="Write your submission..."></textarea>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-indigo-600 mb-1.5 flex items-center gap-2">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                                                        Attach Archive Files (.zip, .pdf)
                                                    </label>
                                                    <input type="file" onChange={(e) => setFile(e.target.files[0])} className="w-full block text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer" />
                                                </div>
                                                <button type="submit" className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-bold shadow-lg hover:bg-gray-800 transition hover:-translate-y-0.5">Submit Work</button>
                                            </form>
                                        </div>
                                    )}

                                    {studentView === 'exams' && (
                                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 animate-fade-in-up">
                                            <h2 className="text-2xl font-black text-gray-900 mb-6">Upcoming Examinations</h2>
                                            <div className="space-y-4">
                                                <div className="p-4 border border-gray-100 rounded-xl flex justify-between items-center hover:shadow-md transition">
                                                    <div>
                                                        <h4 className="font-bold text-gray-800 text-lg">React.js</h4>
                                                        <p className="text-gray-500 text-sm">Room 304 • Prof. Alan Turing</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-black text-indigo-600">Nov 15</div>
                                                        <div className="text-gray-500 text-xs font-bold uppercase tracking-wider">09:00 AM</div>
                                                    </div>
                                                </div>
                                                <div className="p-4 border border-gray-100 rounded-xl flex justify-between items-center hover:shadow-md transition">
                                                    <div>
                                                        <h4 className="font-bold text-gray-800 text-lg">Node.js</h4>
                                                        <p className="text-gray-500 text-sm">Main Hall • Prof. Grace Hopper</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-black text-indigo-600">Nov 18</div>
                                                        <div className="text-gray-500 text-xs font-bold uppercase tracking-wider">02:00 PM</div>
                                                    </div>
                                                </div>
                                                <div className="p-4 border border-gray-100 rounded-xl flex justify-between items-center hover:shadow-md transition">
                                                    <div>
                                                        <h4 className="font-bold text-gray-800 text-lg">Python Programming</h4>
                                                        <p className="text-gray-500 text-sm">Lab 2 • Prof. Guido van Rossum</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-black text-indigo-600">Nov 22</div>
                                                        <div className="text-gray-500 text-xs font-bold uppercase tracking-wider">10:00 AM</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {studentView === 'fees' && (
                                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 animate-fade-in-up">
                                            <h2 className="text-2xl font-black text-gray-900 mb-6">Financial Status</h2>
                                            {fees.length > 0 ? (
                                                <div className="space-y-8">
                                                    <div className="grid md:grid-cols-3 gap-4">
                                                        <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100 text-center">
                                                            <div className="text-gray-500 text-sm font-bold uppercase tracking-wider mb-1">Total Due</div>
                                                            <div className="text-3xl font-black text-gray-900">₹{fees[0].amountDue || '0'}</div>
                                                        </div>
                                                        <div className="p-6 bg-green-50 rounded-2xl border border-green-100 text-center">
                                                            <div className="text-green-600 text-sm font-bold uppercase tracking-wider mb-1">Amount Paid</div>
                                                            <div className="text-3xl font-black text-green-700">₹{fees[0].amountPaid || '0'}</div>
                                                        </div>
                                                        <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100 text-center flex flex-col items-center justify-center">
                                                            <div className="text-indigo-600 text-sm font-bold uppercase tracking-wider mb-2">Status</div>
                                                            <div><span className={`inline-block px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${fees[0].status === 'Paid' ? 'bg-green-500 text-white shadow-md' : fees[0].status === 'Overdue' ? 'bg-red-500 text-white shadow-md' : 'bg-yellow-400 text-yellow-900 shadow-sm'}`}>{fees[0].status}</span></div>
                                                        </div>
                                                    </div>
                                                    
                                                    {fees[0].status === 'Pending' && !paymentSuccess && (
                                                        <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100">
                                                            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                                                                <div>
                                                                    <h3 className="font-black text-indigo-900 text-lg">Clear Your Dues</h3>
                                                                    <p className="text-indigo-700 text-sm">Pay your pending balance of ₹{fees[0].amountDue - fees[0].amountPaid} instantly via UPI.</p>
                                                                </div>
                                                                {!qrPaymentActive ? (
                                                                    <button onClick={() => {
                                                                        setQrPaymentActive(true);
                                                                        setTimeout(() => {
                                                                            setPaymentSuccess(true);
                                                                            setQrPaymentActive(false);
                                                                            // Mock local status update
                                                                            setFees([{...fees[0], status: 'Paid', amountPaid: fees[0].amountDue}]);
                                                                        }, 5000);
                                                                    }} className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition hover:-translate-y-0.5">Pay Now</button>
                                                                ) : (
                                                                    <div className="flex flex-col items-center p-4 bg-white rounded-xl shadow-inner">
                                                                        <QRCodeSVG value={`upi://pay?pa=7989439944@upi&pn=EduPortal&am=${fees[0].amountDue - fees[0].amountPaid}`} size={128} />
                                                                        <p className="text-xs text-center text-gray-500 mt-2">Scan with any UPI app<br/><span className="text-[10px] text-indigo-500 font-bold animate-pulse">Awaiting payment confirmation...</span></p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                    
                                                    {paymentSuccess && (
                                                        <div className="bg-green-50 p-6 rounded-2xl border border-green-100 text-center animate-fade-in-up">
                                                            <div className="w-16 h-16 mx-auto bg-green-500 text-white rounded-full flex items-center justify-center mb-4 shadow-lg shadow-green-200">
                                                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                                            </div>
                                                            <h3 className="text-2xl font-black text-green-900 mb-1">Payment Successful!</h3>
                                                            <p className="text-green-700">Your transaction was verified in real-time. Your account is clear.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                                    <p className="text-gray-500">No financial records generated yet.</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {studentView === 'syllabus' && (
                                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 animate-fade-in-up">
                                            <h2 className="text-2xl font-black text-gray-900 mb-6">Curriculum Syllabus</h2>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {subjects.length > 0 ? subjects.map(sub => (
                                                    <div key={sub.id} className="p-5 border border-gray-100 bg-gray-50 rounded-2xl hover:border-indigo-200 hover:bg-white transition group shadow-sm">
                                                        <div className="font-black text-gray-800 text-lg mb-1 group-hover:text-indigo-600 transition">{sub.name}</div>
                                                        <div className="inline-block px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded uppercase tracking-widest">{sub.code}</div>
                                                    </div>
                                                )) : (
                                                    <div className="col-span-2 p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                                        <p className="text-gray-500">The curriculum has not been published yet.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {studentView === 'profile' && (
                                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 max-w-2xl animate-fade-in-up">
                                            <h2 className="text-2xl font-black text-gray-900 mb-6">My Profile</h2>
                                            <div className="grid md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-500 mb-1">Full Name</label>
                                                    <div className="p-3 bg-gray-50 rounded-xl font-medium text-gray-900 border border-gray-100">{currentUser.name}</div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-500 mb-1">Email Address</label>
                                                    <div className="p-3 bg-gray-50 rounded-xl font-medium text-gray-900 border border-gray-100">{currentUser.email}</div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-500 mb-1">Roll Number</label>
                                                    <div className="p-3 bg-indigo-50 text-indigo-900 rounded-xl font-black border border-indigo-100 tracking-wider">{currentUser.rollNumber || 'N/A'}</div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-500 mb-1">Phone Number</label>
                                                    <div className="p-3 bg-gray-50 rounded-xl font-medium text-gray-900 border border-gray-100">{currentUser.phoneNumber || 'Not Provided'}</div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-500 mb-1">Department</label>
                                                    <div className="p-3 bg-gray-50 rounded-xl font-medium text-gray-900 border border-gray-100">{currentUser.department || 'Computer Science'}</div>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-500 mb-1">Semester & Section</label>
                                                    <div className="p-3 bg-gray-50 rounded-xl font-medium text-gray-900 border border-gray-100">Sem {currentUser.semester || '1'} • Sec {currentUser.section || 'A'}</div>
                                                </div>
                                                <div className="md:col-span-2 mt-4 pt-4 border-t border-gray-100">
                                                    <label className="block text-sm font-bold text-gray-500 mb-1">Role / Status</label>
                                                    <div className="p-3 bg-gray-50 rounded-xl font-bold text-indigo-700 uppercase tracking-widest text-xs border border-gray-100 flex gap-2 items-center w-max">
                                                        <span className="bg-indigo-100 px-2 py-1 rounded">{currentUser.role}</span>
                                                        <span className="text-gray-300">•</span>
                                                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded">{currentUser.status}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {studentView === 'ai-interview' && (
                                        <div className="bg-gray-900 p-8 rounded-3xl shadow-2xl border border-gray-800 text-white animate-fade-in-up">
                                            <div className="flex justify-between items-center mb-6">
                                                <div>
                                                    <h2 className="text-2xl font-black text-white flex items-center gap-2">
                                                        <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                                                        AI Mock Interview
                                                    </h2>
                                                    <p className="text-gray-400 text-sm mt-1">Practice your technical skills with our AI interviewer.</p>
                                                </div>
                                                <span className="flex h-3 w-3">
                                                  <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75"></span>
                                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                                </span>
                                            </div>

                                            <div className="grid md:grid-cols-2 gap-8">
                                                <div>
                                                    <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-gray-700 relative shadow-inner">
                                                        {aiInterviewActive ? (
                                                            <Webcam audio={true} className="w-full h-full object-cover transform scale-x-[-1]" />
                                                        ) : (
                                                            <div className="absolute inset-0 flex items-center justify-center text-gray-600 font-medium">Camera Offline</div>
                                                        )}
                                                        <div className="absolute bottom-4 right-4 flex gap-2">
                                                            <div className={`w-2 h-2 rounded-full ${aiInterviewActive ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`}></div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="mt-6">
                                                        <button 
                                                            onClick={() => {
                                                                if (!aiInterviewActive) {
                                                                    setAiInterviewActive(true);
                                                                    setAiInterviewStage('question1');
                                                                    setAiQuestion('Great. Let us begin. Can you explain the difference between functional and class components in React?');
                                                                    // Simulated voice synthesis
                                                                    if ('speechSynthesis' in window) {
                                                                        const msg = new SpeechSynthesisUtterance('Great. Let us begin. Can you explain the difference between functional and class components in React?');
                                                                        msg.rate = 0.9;
                                                                        window.speechSynthesis.speak(msg);
                                                                    }
                                                                } else {
                                                                    setAiInterviewActive(false);
                                                                    setAiInterviewStage('start');
                                                                    setAiInterviewTranscript('');
                                                                    setAiQuestion('Welcome to your mock interview. Are you ready to begin?');
                                                                    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                                                                }
                                                            }}
                                                            className={`w-full py-3.5 font-bold rounded-xl shadow-lg transition hover:-translate-y-0.5 ${!aiInterviewActive ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-red-600 text-white hover:bg-red-700'}`}>
                                                            {aiInterviewActive ? 'End Session' : 'Start Mock Interview'}
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col h-full bg-gray-800 rounded-2xl border border-gray-700 p-4">
                                                    <div className="flex-1 overflow-y-auto space-y-4">
                                                        <div className="bg-indigo-900/50 border border-indigo-500/30 p-3 rounded-lg text-sm text-indigo-200">
                                                            <span className="font-bold text-indigo-400 block mb-1">AI Interviewer</span>
                                                            {aiQuestion}
                                                        </div>
                                                        {aiInterviewTranscript && (
                                                            <div className="bg-gray-700 border border-gray-600 p-3 rounded-lg text-sm text-gray-200 ml-8 relative">
                                                                <span className="font-bold text-gray-400 block mb-1">You</span>
                                                                {aiInterviewTranscript}
                                                                <div className="absolute -left-2 top-4 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    
                                                    {aiInterviewActive && (
                                                        <div className="mt-4 pt-4 border-t border-gray-700">
                                                            <button onClick={() => {
                                                                // Simulated voice recognition success
                                                                setAiInterviewTranscript("Functional components use hooks, while class components use lifecycle methods and the 'this' keyword.");
                                                                setTimeout(() => {
                                                                    setAiQuestion("Excellent. Now, how does Node.js handle asynchronous operations?");
                                                                    if ('speechSynthesis' in window) {
                                                                        const msg = new SpeechSynthesisUtterance('Excellent. Now, how does Node.js handle asynchronous operations?');
                                                                        msg.rate = 0.9;
                                                                        window.speechSynthesis.speak(msg);
                                                                    }
                                                                }, 2000);
                                                            }} className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 font-bold rounded-lg text-sm border border-gray-600 transition flex justify-center items-center gap-2">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                                                                Simulate Answer
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* FINANCIAL STAFF DASHBOARD */}
                        {currentUser.role === 'financial_staff' && (
                            <div className="space-y-8 max-w-6xl mx-auto">
                                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                                    <h3 className="text-xl font-black text-gray-900 mb-4">Fee Management</h3>
                                    <div className="space-y-4">
                                        {financialStaffStudents.filter(s => s.status === 'approved').map(student => {
                                            const fee = fees.find(f => f.userId === student.id) || { amountDue: '', amountPaid: '', status: 'Pending' };
                                            return (
                                                <div key={student.id} className="p-4 border border-gray-100 rounded-xl bg-gray-50">
                                                    <div className="font-bold text-gray-800 mb-2">{student.name}</div>
                                                    <div className="grid grid-cols-2 gap-2 mb-2">
                                                        <input id={`fee-due-${student.id}`} type="number" defaultValue={fee.amountDue} placeholder="Amount Due" className="p-2 text-sm rounded border border-gray-200 outline-none" />
                                                        <input id={`fee-paid-${student.id}`} type="number" defaultValue={fee.amountPaid} placeholder="Amount Paid" className="p-2 text-sm rounded border border-gray-200 outline-none" />
                                                    </div>
                                                    <div className="flex gap-2 items-center">
                                                        <select id={`fee-status-${student.id}`} defaultValue={fee.status} className="p-2 text-sm rounded border border-gray-200 flex-1 outline-none">
                                                            <option value="Pending">Pending</option>
                                                            <option value="Paid">Paid</option>
                                                            <option value="Overdue">Overdue</option>
                                                        </select>
                                                        <button onClick={() => {
                                                            const due = document.getElementById(`fee-due-${student.id}`).value;
                                                            const paid = document.getElementById(`fee-paid-${student.id}`).value;
                                                            const status = document.getElementById(`fee-status-${student.id}`).value;
                                                            handleFeeUpdate(student.id, due, paid, status);
                                                        }} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700 text-sm">Save</button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* REGULAR STAFF DASHBOARD */}
                        {currentUser.role === 'regular_staff' && (
                            <div className="space-y-8 max-w-6xl mx-auto">
                                <div className="grid md:grid-cols-2 gap-8">
                                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                                        <h3 className="text-xl font-black text-gray-900 mb-4">Student Approvals</h3>
                                        <div className="overflow-hidden rounded-xl border border-gray-100">
                                            <table className="w-full text-left border-collapse text-sm">
                                                <thead className="bg-gray-50">
                                                    <tr><th className="p-3 font-bold text-gray-600">Student Name</th><th className="p-3 font-bold text-gray-600 text-right">Action</th></tr>
                                                </thead>
                                                <tbody>
                                                    {regularStaffStudents.filter(s => s.status === 'pending').map(student => (
                                                        <tr key={student.id} className="border-t border-gray-100">
                                                            <td className="p-3">{student.name} ({student.email})</td>
                                                            <td className="p-3 text-right">
                                                                <button onClick={() => handleApprove(student.id)} className="px-3 py-1.5 bg-green-500 text-white rounded font-bold text-xs hover:bg-green-600">Approve</button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {regularStaffStudents.filter(s => s.status === 'pending').length === 0 && <tr><td colSpan="2" className="p-4 text-center text-gray-500">No pending students</td></tr>}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                                        <h3 className="text-xl font-black text-gray-900 mb-4">Curriculum Management</h3>
                                        <form onSubmit={handleSubjectAdd} className="mb-4 space-y-2">
                                            <input name="subjectName" type="text" placeholder="Subject Name" required className="w-full p-2 text-sm rounded border border-gray-200 outline-none" />
                                            <input name="subjectCode" type="text" placeholder="Subject Code (e.g. CS101)" required className="w-full p-2 text-sm rounded border border-gray-200 outline-none" />
                                            <button type="submit" className="w-full py-2 bg-indigo-600 text-white font-bold rounded hover:bg-indigo-700 text-sm">Add Subject</button>
                                        </form>
                                        <div className="space-y-2">
                                            {subjects.map(sub => (
                                                <div key={sub.id} className="p-3 bg-gray-50 rounded-lg flex justify-between items-center text-sm font-medium">
                                                    <span>{sub.name} <span className="text-gray-500 font-normal">({sub.code})</span></span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                                    <h3 className="text-xl font-black text-gray-900 mb-4">Generate Official Transcript</h3>
                                    
                                    <form onSubmit={handleTranscriptSearch} className="flex gap-2 mb-6">
                                        <input type="text" value={searchRollNumber} onChange={e => setSearchRollNumber(e.target.value)} placeholder="Enter Roll Number (e.g. EDU12345)" required className="flex-1 p-3 border border-gray-200 rounded-lg outline-none font-mono" />
                                        <button type="submit" className="px-6 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700">Search Student</button>
                                    </form>

                                    {transcriptStudentInfo && (
                                        <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
                                            <div className="grid grid-cols-2 gap-4 mb-6">
                                                <div><span className="text-gray-500 text-xs font-bold uppercase block">Name</span><span className="font-bold text-lg">{transcriptStudentInfo.name}</span></div>
                                                <div><span className="text-gray-500 text-xs font-bold uppercase block">Dept / Sec</span><span className="font-bold text-lg">{transcriptStudentInfo.department} - {transcriptStudentInfo.section}</span></div>
                                            </div>
                                            
                                            <div className="space-y-3 mb-6">
                                                <div className="flex gap-4 font-bold text-gray-600 text-sm">
                                                    <div className="flex-1">Subject</div>
                                                    <div className="w-24">Credits</div>
                                                    <div className="w-24">Marks</div>
                                                </div>
                                                {transcriptMarksForm.map((item, index) => (
                                                    <div key={index} className="flex gap-4 items-center">
                                                        <div className="flex-1 font-bold text-gray-800">{item.subjectName}</div>
                                                        <input type="number" value={item.credits} onChange={e => {
                                                            const newForm = [...transcriptMarksForm];
                                                            newForm[index].credits = e.target.value;
                                                            setTranscriptMarksForm(newForm);
                                                        }} className="w-24 p-2 border border-gray-200 rounded outline-none" placeholder="Cr" />
                                                        <input type="number" value={item.marks} onChange={e => {
                                                            const newForm = [...transcriptMarksForm];
                                                            newForm[index].marks = e.target.value;
                                                            setTranscriptMarksForm(newForm);
                                                        }} className="w-24 p-2 border border-gray-200 rounded outline-none" placeholder="Mk" />
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            <div className="flex gap-4">
                                                <button onClick={handleSaveTranscriptMarks} className="flex-1 py-3 bg-gray-900 text-white font-bold rounded-lg hover:bg-gray-800">Save Marks to Database</button>
                                                <button onClick={() => downloadTranscriptPDF(transcriptStudentInfo, transcriptMarksForm)} className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                                    Generate PDF
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ADMIN DASHBOARD */}
                        {currentUser.role === 'admin' && (
                            <div className="space-y-8 max-w-5xl mx-auto">
                                <div className="grid md:grid-cols-2 gap-8 mb-8">
                                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                                        <h3 className="text-xl font-black text-gray-900 mb-4">Create Faculty/Staff</h3>
                                        <form onSubmit={async (e) => {
                                            e.preventDefault();
                                            const res = await fetch('http://localhost:5000/api/admin/create-user', {
                                                method: 'POST',
                                                headers: {'Content-Type': 'application/json'},
                                                body: JSON.stringify({ name: e.target.name.value, email: e.target.email.value, role: e.target.role.value })
                                            });
                                            const data = await res.json();
                                            if (res.ok) {
                                                alert(`User created! Password: ${data.password}`);
                                                e.target.reset();
                                                fetchUsers();
                                            } else alert(data.error);
                                        }} className="space-y-4">
                                            <input name="name" type="text" placeholder="Full Name" required className="w-full p-2 border border-gray-200 rounded outline-none" />
                                            <input name="email" type="email" placeholder="Email" required className="w-full p-2 border border-gray-200 rounded outline-none" />
                                            <select name="role" required className="w-full p-2 border border-gray-200 rounded outline-none">
                                                <option value="faculty">Faculty</option>
                                                <option value="regular_staff">Regular Staff</option>
                                                <option value="financial_staff">Financial Staff</option>
                                            </select>
                                            <button type="submit" className="w-full py-2 bg-indigo-600 text-white font-bold rounded">Create User</button>
                                        </form>
                                    </div>
                                    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                                        <h3 className="text-xl font-black text-gray-900 mb-4">Upload Students (Excel)</h3>
                                        <form onSubmit={async (e) => {
                                            e.preventDefault();
                                            const formData = new FormData();
                                            formData.append('excelFile', e.target.excelFile.files[0]);
                                            const res = await fetch('http://localhost:5000/api/admin/upload-students', {
                                                method: 'POST',
                                                body: formData
                                            });
                                            const data = await res.json();
                                            if (res.ok) {
                                                alert(data.message);
                                                e.target.reset();
                                                fetchUsers();
                                            } else alert(data.error);
                                        }} className="space-y-4 flex flex-col justify-center h-full pb-8">
                                            <input name="excelFile" type="file" accept=".xlsx, .xls, .csv" required className="w-full text-sm block text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-green-50 file:text-green-700 hover:file:bg-green-100" />
                                            <button type="submit" className="w-full py-2 bg-green-600 text-white font-bold rounded">Import Students</button>
                                        </form>
                                    </div>
                                </div>
                                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                                    <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-3">
                                        <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                                        </div>
                                        User Management Access
                                    </h2>
                                    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-50/50">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-white border-b border-gray-100">
                                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">User Profile</th>
                                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Role</th>
                                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Account Status</th>
                                                    <th className="p-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {users.map(user => (
                                                    <tr key={user.id} className="hover:bg-white transition">
                                                        <td className="p-4">
                                                            <div className="font-bold text-gray-900">{user.name}</div>
                                                            <div className="text-sm text-gray-500">{user.email}</div>
                                                        </td>
                                                        <td className="p-4">
                                                            <select
                                                                value={user.role}
                                                                onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                                                className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-bold uppercase rounded-md outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer border-none mb-1 block"
                                                            >
                                                                <option value="student">STUDENT</option>
                                                                <option value="faculty">FACULTY</option>
                                                                <option value="financial_staff">FINANCIAL STAFF</option>
                                                                <option value="regular_staff">REGULAR STAFF</option>
                                                            </select>
                                                            {user.role === 'faculty' && (
                                                                <select 
                                                                    value={user.assignedSubjectId || ''} 
                                                                    onChange={async (e) => {
                                                                        await fetch('http://localhost:5000/api/admin/assign-subject', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({id: user.id, subjectId: e.target.value}) });
                                                                        alert('Subject Assigned!');
                                                                        fetchUsers();
                                                                    }} 
                                                                    className="px-2 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase rounded-md outline-none cursor-pointer border-none block w-full max-w-[120px] mt-1"
                                                                >
                                                                    <option value="">Assign Subject...</option>
                                                                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                                </select>
                                                            )}
                                                        </td>
                                                        <td className="p-4">
                                                            {user.status === 'pending' ? (
                                                                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold uppercase rounded-full flex items-center w-max gap-1">
                                                                    <span className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse"></span> Pending
                                                                </span>
                                                            ) : (
                                                                <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold uppercase rounded-full flex items-center w-max gap-1">
                                                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Approved
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="p-4 flex items-center justify-end gap-2">
                                                            {user.status === 'pending' && (
                                                                <button onClick={() => handleApprove(user.id)} className="px-4 py-2 text-sm font-bold text-white bg-green-500 hover:bg-green-600 rounded-lg shadow-sm hover:shadow transition">
                                                                    Approve
                                                                </button>
                                                            )}
                                                            <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                                                <select id={`pw-type-${user.id}`} className="px-3 py-2 text-sm bg-transparent border-none outline-none focus:ring-0 text-gray-600 font-medium cursor-pointer">
                                                                    <option value="complex">Complex</option>
                                                                    <option value="alphanumeric">Alphanumeric</option>
                                                                    <option value="numeric">Numeric</option>
                                                                </select>
                                                                <button onClick={() => handleGeneratePassword(user.id, document.getElementById(`pw-type-${user.id}`).value)} className="px-3 py-2 bg-gray-50 text-indigo-600 text-sm font-bold border-l border-gray-200 hover:bg-indigo-50 transition">
                                                                    Reset Pw
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                                {users.length === 0 && (
                                                    <tr><td colSpan="4" className="p-8 text-center text-gray-400">No users found.</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* FACULTY DASHBOARD */}
                        {currentUser.role === 'faculty' && (
                            <div className="flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto">
                                <div className="lg:w-64 shrink-0 space-y-2 relative z-20">
                                    {['attendance', 'submissions', 'schedule', 'students'].map(v => (
                                        <button key={v} onClick={() => setFacultyView(v)} className={`w-full text-left px-5 py-3 rounded-2xl font-bold transition-all duration-300 flex items-center justify-between group ${facultyView === v ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 translate-x-2' : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900 border border-gray-100'}`}>
                                            <span className="capitalize">{v}</span>
                                        </button>
                                    ))}
                                </div>
                                
                                <div className="flex-1 w-full relative">
                                    {/* Attendance */}
                                    {facultyView === 'attendance' && (
                                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 max-w-2xl">
                                            <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
                                                <span className="p-1.5 bg-rose-100 text-rose-600 rounded-lg"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></span>
                                                Live Roll Call
                                            </h3>
                                            <div className="mb-4 space-y-2">
                                                <input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} className="w-full p-2 border border-gray-200 rounded text-sm outline-none" />
                                                <select value={attendanceSubjectId} onChange={(e) => setAttendanceSubjectId(e.target.value)} className="w-full p-2 border border-gray-200 rounded text-sm outline-none">
                                                    <option value="">Select Subject...</option>
                                                    {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.name} ({sub.code})</option>)}
                                                </select>
                                            </div>
                                            <div className="space-y-3">
                                                {approvedStudents.map((student) => {
                                                    const record = classAttendance.find(a => a.userId === student.userId) || { status: 'Pending' };
                                                    return (
                                                    <div key={student.userId} className="p-3 border border-gray-100 rounded-xl hover:bg-gray-50 transition flex justify-between items-center group">
                                                        <div>
                                                            <div className="font-bold text-gray-800 text-sm">{student.name}</div>
                                                            <span className={`text-[10px] font-black uppercase tracking-wider ${record.status === 'Present' ? 'text-green-500' : record.status === 'Absent' ? 'text-rose-500' : 'text-yellow-500'}`}>{record.status}</span>
                                                        </div>
                                                        <div className="space-x-1 opacity-0 group-hover:opacity-100 transition">
                                                            <button onClick={() => handleAttendanceChange(student.userId, student.name, 'Present')} className="px-2 py-1 bg-green-50 text-green-700 text-xs font-bold rounded hover:bg-green-100">P</button>
                                                            <button onClick={() => handleAttendanceChange(student.userId, student.name, 'Absent')} className="px-2 py-1 bg-rose-50 text-rose-700 text-xs font-bold rounded hover:bg-rose-100">A</button>
                                                        </div>
                                                    </div>
                                                    );
                                                })}
                                                {approvedStudents.length === 0 && <p className="text-gray-400 text-sm italic">No students approved yet.</p>}
                                            </div>
                                        </div>
                                    )}

                                    {/* Submissions */}
                                    {facultyView === 'submissions' && (
                                        <div className="space-y-6">
                                            <h3 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                                                <span className="p-2 bg-indigo-100 text-indigo-600 rounded-xl"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg></span>
                                                Evaluation Deck
                                            </h3>

                                            {submissions.length === 0 ? (
                                                <div className="p-12 text-center bg-white border border-gray-100 border-dashed rounded-3xl text-gray-400 font-medium">No assignments queued for inspection.</div>
                                            ) : (
                                                submissions.map((sub) => (
                                                    <div key={sub.id} className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 overflow-hidden relative">
                                                        <div className="flex justify-between items-start mb-4 relative z-10">
                                                            <div>
                                                                <h4 className="font-black text-xl text-gray-900">{sub.studentName}</h4>
                                                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                                                    <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2 py-1 rounded-md">{sub.assignmentType}</span>
                                                                    <span className="text-xs bg-purple-50 text-purple-700 font-bold px-2 py-1 rounded-md">{sub.subjectName || 'General Subject'}</span>
                                                                    <span className="text-xs text-gray-400 font-medium">{sub.date}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="bg-gray-50/80 rounded-xl p-4 mb-4 border border-gray-100">
                                                            <p className="text-sm text-gray-700 font-mono whitespace-pre-wrap">{sub.textContent || '// No text appended.'}</p>
                                                        </div>

                                                        {sub.fileName && (
                                                            <div className="mb-6">
                                                                {sub.fileName.endsWith('.pdf') ? (
                                                                    <div className="w-full h-96 border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                                                                        <iframe src={`http://localhost:5000/uploads/${sub.fileName}`} className="w-full h-full" title="PDF Preview"></iframe>
                                                                    </div>
                                                                ) : (
                                                                    <a href={`http://localhost:5000/uploads/${sub.fileName}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition mb-6 w-max">
                                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                                                        Download Attached Asset
                                                                    </a>
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="flex flex-wrap items-center gap-3 bg-gray-900 p-2 rounded-2xl relative z-10">
                                                            <input id={`grade-mark-${sub.id}`} type="text" defaultValue={sub.marks} placeholder="Score" className="w-20 px-4 py-2 rounded-xl bg-white/10 text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-indigo-400 border border-white/5 text-center font-bold" />
                                                            <input id={`grade-fb-${sub.id}`} type="text" defaultValue={sub.feedback} placeholder="Feedback notes..." className="flex-1 min-w-[200px] px-4 py-2 rounded-xl bg-white/10 text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-indigo-400 border border-white/5 text-sm" />
                                                            <button onClick={() => {
                                                                const marks = document.getElementById(`grade-mark-${sub.id}`).value;
                                                                const fb = document.getElementById(`grade-fb-${sub.id}`).value;
                                                                handleGradeSubmit(sub.id, marks, fb);
                                                            }} className="px-6 py-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-xl shadow-lg transition">
                                                                Save
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}

                                    {/* Schedule */}
                                    {facultyView === 'schedule' && (
                                        <div className="space-y-6">
                                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                                                <h3 className="text-xl font-black text-gray-900 mb-4">Add Class Schedule</h3>
                                                <form onSubmit={handleAddSchedule} className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                                    <select required value={scheduleForm.subjectId} onChange={e => setScheduleForm({...scheduleForm, subjectId: e.target.value})} className="col-span-2 md:col-span-1 p-2 border border-gray-200 rounded-lg text-sm outline-none">
                                                        <option value="">Subject</option>
                                                        {subjects.map(s => <option key={s.id} value={s.id}>{s.code}</option>)}
                                                    </select>
                                                    <input required type="date" value={scheduleForm.date} onChange={e => setScheduleForm({...scheduleForm, date: e.target.value})} className="p-2 border border-gray-200 rounded-lg text-sm outline-none" />
                                                    <input required type="time" value={scheduleForm.time} onChange={e => setScheduleForm({...scheduleForm, time: e.target.value})} className="p-2 border border-gray-200 rounded-lg text-sm outline-none" />
                                                    <input required type="text" placeholder="Room" value={scheduleForm.room} onChange={e => setScheduleForm({...scheduleForm, room: e.target.value})} className="p-2 border border-gray-200 rounded-lg text-sm outline-none" />
                                                    <select value={scheduleForm.type} onChange={e => setScheduleForm({...scheduleForm, type: e.target.value})} className="p-2 border border-gray-200 rounded-lg text-sm outline-none">
                                                        <option>Lecture</option>
                                                        <option>Lab</option>
                                                        <option>Exam</option>
                                                    </select>
                                                    <button type="submit" className="col-span-2 md:col-span-5 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition">Add Schedule</button>
                                                </form>
                                            </div>

                                            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                                                <h3 className="text-xl font-black text-gray-900 mb-4">Current Schedules</h3>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left border-collapse">
                                                        <thead>
                                                            <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-bold">
                                                                <th className="p-4">Subject</th>
                                                                <th className="p-4">Date & Time</th>
                                                                <th className="p-4">Room</th>
                                                                <th className="p-4">Type</th>
                                                                <th className="p-4">Action</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {schedules.map(sch => (
                                                                <tr key={sch.id} className="hover:bg-gray-50/50">
                                                                    <td className="p-4 font-bold text-gray-900">{sch.subjectCode} - {sch.subjectName}</td>
                                                                    <td className="p-4 text-sm text-gray-600">{sch.date} | {sch.time}</td>
                                                                    <td className="p-4 text-sm text-gray-600">{sch.room}</td>
                                                                    <td className="p-4 text-sm"><span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded font-bold">{sch.type}</span></td>
                                                                    <td className="p-4">
                                                                        <button onClick={() => handleDeleteSchedule(sch.id)} className="text-rose-500 hover:text-rose-700 font-bold text-sm">Delete</button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                            {schedules.length === 0 && (
                                                                <tr><td colSpan="5" className="p-8 text-center text-gray-400">No schedules found.</td></tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Student Data */}
                                    {facultyView === 'students' && (
                                        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                                            <h3 className="text-2xl font-black text-gray-900 mb-6">Complete Student Roster</h3>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-gray-900 text-white text-xs uppercase tracking-wider font-bold">
                                                            <th className="p-4 rounded-tl-xl">Roll Number</th>
                                                            <th className="p-4">Name</th>
                                                            <th className="p-4">Email</th>
                                                            <th className="p-4">Phone</th>
                                                            <th className="p-4">Dept & Sec</th>
                                                            <th className="p-4 rounded-tr-xl">Sem</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100">
                                                        {approvedStudents.map(student => (
                                                            <tr key={student.userId} className="hover:bg-gray-50">
                                                                <td className="p-4 font-mono font-bold text-indigo-600">{student.rollNumber || 'N/A'}</td>
                                                                <td className="p-4 font-bold text-gray-900">{student.name}</td>
                                                                <td className="p-4 text-sm text-gray-500">{student.email}</td>
                                                                <td className="p-4 text-sm text-gray-500">{student.phoneNumber || 'N/A'}</td>
                                                                <td className="p-4 text-sm text-gray-600">{student.department || 'N/A'} - {student.section || 'N/A'}</td>
                                                                <td className="p-4 font-bold text-gray-700">{student.semester || 'N/A'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}