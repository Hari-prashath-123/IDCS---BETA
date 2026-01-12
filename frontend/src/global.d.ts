declare module '*.jsx' {
  const Component: any;
  export default Component;
}

declare module '*.js' {
  const Component: any;
  export default Component;
}

declare module '*.png';

declare module '*.svg';

declare module './pages/Login' {
  const Login: any;
  export default Login;
}

declare module './pages/AdminDashboard' {
  const AdminDashboard: any;
  export default AdminDashboard;
}
