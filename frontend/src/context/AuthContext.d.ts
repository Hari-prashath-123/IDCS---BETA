export interface User {
  id: number;
  username: string;
  email: string;
  name?: string;
  role?: string;
  is_superuser?: boolean;
  is_staff?: boolean;
  is_student?: boolean;
  is_faculty?: boolean;
  is_department_admin?: boolean;
  department_admin_for?: string;
  department?: string;
}

export interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ user: User }>;
  logout: () => void;
}

export const AuthContext: React.Context<AuthContextType>;
export function useAuth(): AuthContextType;
export const AuthProvider: React.FC<{ children: React.ReactNode }>;
export default AuthProvider;
