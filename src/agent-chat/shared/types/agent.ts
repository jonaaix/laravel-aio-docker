export interface AgentResource {
    name: string;
    size: number;
}

export interface Agent {
    id: string;
    name: string;
    role: string;
    model: string | null;
    lead: boolean;
    instructions: string;
    resources: AgentResource[];
}

export interface AgentInput {
    name: string;
    role: string;
    model: string | null;
    instructions: string;
    uploads: { id: string; filename: string }[];
    removedResources: string[];
}
