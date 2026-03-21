export interface ProjectWithFolders {
  id: string;
  name: string;
  description: string | null;
  ownerId: string | null;
  createdAt: Date;
  updatedAt: Date;
  folders: FolderWithDesigns[];
  _count?: { folders: number };
}

export interface FolderWithDesigns {
  id: string;
  name: string;
  projectId: string;
  parentId: string | null;
  order: number;
  createdAt: Date;
  designs: DesignWithComments[];
  children?: FolderWithDesigns[];
}

export interface DesignWithComments {
  id: string;
  name: string;
  type: string;
  filePath: string | null;
  content: string | null;
  folderId: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  comments: CommentWithReplies[];
}

export interface CommentWithReplies {
  id: string;
  designId: string;
  xPercent: number;
  yPercent: number;
  pinNumber: number;
  content: string;
  authorName: string;
  authorId: string | null;
  resolved: boolean;
  createdAt: Date;
  updatedAt: Date;
  replies: ReplyData[];
}

export interface ReplyData {
  id: string;
  commentId: string;
  content: string;
  authorName: string;
  authorId: string | null;
  createdAt: Date;
}
