import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./pages/Layout";
import { Toaster } from "react-hot-toast";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import Team from "./pages/Team";
import ProjectDetails from "./pages/ProjectDetails";
import ProfileSettings from "./pages/ProfileSettings";
import CRM from "./pages/CRM";
import Login from "./pages/Login";
import { useAuth } from "./context/AuthContext";
import { Loader2Icon } from "lucide-react";

const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth()

    if (loading) return (
        <div className="flex items-center justify-center h-screen bg-white dark:bg-zinc-950">
            <Loader2Icon className="size-7 text-blue-500 animate-spin" />
        </div>
    )

    if (!user) return <Navigate to="/login" replace />

    return children
}

const App = () => {
    return (
        <>
            <Toaster />
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }>
                    <Route index element={<Dashboard />} />
                    <Route path="team" element={<Team />} />
                    <Route path="projects" element={<Projects />} />
                    <Route path="projectsDetail" element={<ProjectDetails />} />
                    <Route path="taskDetails" element={<Navigate to="/projects" replace />} />
                    <Route path="settings" element={<ProfileSettings />} />
                    <Route path="crm" element={<CRM />} />
                </Route>
            </Routes>
        </>
    );
};

export default App;
