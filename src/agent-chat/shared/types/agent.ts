export interface AgentResource {
    name: string;
    size: number;
}

export interface Agent {
    id: string;
    name: string;
    role: string;
    model: string | null;
    effort: string | null;
    lead: boolean;
    instructions: string;
    avatarSeed: string | null;
    avatarUrl: string | null;
    resources: AgentResource[];
}

export interface AgentInput {
    name: string;
    role: string;
    model: string | null;
    effort: string | null;
    instructions: string;
    uploads: { id: string; filename: string }[];
    removedResources: string[];
    avatarSeed: string | null;
    avatarUpload: { id: string; filename: string } | null;
    removeAvatar: boolean;
}
