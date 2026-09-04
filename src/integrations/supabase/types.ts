export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          priority: string
          target_role: string
          title: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          priority?: string
          target_role?: string
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          priority?: string
          target_role?: string
          title?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          created_at: string
          description: string | null
          grade_level: string | null
          id: string
          name: string
          school_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          grade_level?: string | null
          id?: string
          name: string
          school_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          grade_level?: string | null
          id?: string
          name?: string
          school_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      coding_assignment_class_assignments: {
        Row: {
          assigned_by: string | null
          assignment_id: string
          class_id: string
          created_at: string
          due_date_override: string | null
          id: string
        }
        Insert: {
          assigned_by?: string | null
          assignment_id: string
          class_id: string
          created_at?: string
          due_date_override?: string | null
          id?: string
        }
        Update: {
          assigned_by?: string | null
          assignment_id?: string
          class_id?: string
          created_at?: string
          due_date_override?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coding_assignment_class_assignments_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "coding_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coding_assignment_class_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      coding_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          instructions: string | null
          is_published: boolean
          language: string
          max_score: number
          rubric: string | null
          starter_code: string
          test_cases: Json
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          instructions?: string | null
          is_published?: boolean
          language: string
          max_score?: number
          rubric?: string | null
          starter_code?: string
          test_cases?: Json
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          instructions?: string | null
          is_published?: boolean
          language?: string
          max_score?: number
          rubric?: string | null
          starter_code?: string
          test_cases?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      coding_submissions: {
        Row: {
          ai_feedback: string | null
          ai_graded_at: string | null
          ai_suggested_score: number | null
          assignment_id: string
          auto_score: number | null
          code: string
          created_at: string
          graded_at: string | null
          graded_by: string | null
          id: string
          last_run_at: string | null
          last_run_output: string | null
          score: number | null
          status: string
          student_id: string
          submitted_at: string | null
          teacher_feedback: string | null
          test_results: Json | null
          updated_at: string
        }
        Insert: {
          ai_feedback?: string | null
          ai_graded_at?: string | null
          ai_suggested_score?: number | null
          assignment_id: string
          auto_score?: number | null
          code?: string
          created_at?: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          last_run_at?: string | null
          last_run_output?: string | null
          score?: number | null
          status?: string
          student_id: string
          submitted_at?: string | null
          teacher_feedback?: string | null
          test_results?: Json | null
          updated_at?: string
        }
        Update: {
          ai_feedback?: string | null
          ai_graded_at?: string | null
          ai_suggested_score?: number | null
          assignment_id?: string
          auto_score?: number | null
          code?: string
          created_at?: string
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          last_run_at?: string | null
          last_run_output?: string | null
          score?: number | null
          status?: string
          student_id?: string
          submitted_at?: string | null
          teacher_feedback?: string | null
          test_results?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coding_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "coding_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coding_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
        }
        Relationships: []
      }
      exam_answers: {
        Row: {
          answer_text: string | null
          attempt_id: string
          created_at: string | null
          id: string
          is_correct: boolean | null
          marks_awarded: number | null
          question_id: string
          review_text: string | null
        }
        Insert: {
          answer_text?: string | null
          attempt_id: string
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          marks_awarded?: number | null
          question_id: string
          review_text?: string | null
        }
        Update: {
          answer_text?: string | null
          attempt_id?: string
          created_at?: string | null
          id?: string
          is_correct?: boolean | null
          marks_awarded?: number | null
          question_id?: string
          review_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "exam_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_attempts: {
        Row: {
          attempted_at: string | null
          completed_at: string | null
          current_question_index: number | null
          exam_id: string
          feedback: string | null
          graded_at: string | null
          graded_by: string | null
          id: string
          last_activity_at: string | null
          marks_obtained: number | null
          review_opened_at: string | null
          started_at: string | null
          status: string | null
          student_id: string
          submission_type: string | null
        }
        Insert: {
          attempted_at?: string | null
          completed_at?: string | null
          current_question_index?: number | null
          exam_id: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          last_activity_at?: string | null
          marks_obtained?: number | null
          review_opened_at?: string | null
          started_at?: string | null
          status?: string | null
          student_id: string
          submission_type?: string | null
        }
        Update: {
          attempted_at?: string | null
          completed_at?: string | null
          current_question_index?: number | null
          exam_id?: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          last_activity_at?: string | null
          marks_obtained?: number | null
          review_opened_at?: string | null
          started_at?: string | null
          status?: string | null
          student_id?: string
          submission_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_class_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          class_id: string
          due_date: string | null
          exam_id: string
          id: string
          is_active: boolean | null
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          class_id: string
          due_date?: string | null
          exam_id: string
          id?: string
          is_active?: boolean | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          class_id?: string
          due_date?: string | null
          exam_id?: string
          id?: string
          is_active?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_class_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_class_assignments_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_questions: {
        Row: {
          correct_answer: string | null
          created_at: string | null
          exam_id: string
          id: string
          marks: number
          options: Json | null
          order_number: number
          question_text: string
          question_type: Database["public"]["Enums"]["question_type_enum"]
          updated_at: string | null
        }
        Insert: {
          correct_answer?: string | null
          created_at?: string | null
          exam_id: string
          id?: string
          marks?: number
          options?: Json | null
          order_number?: number
          question_text: string
          question_type: Database["public"]["Enums"]["question_type_enum"]
          updated_at?: string | null
        }
        Update: {
          correct_answer?: string | null
          created_at?: string | null
          exam_id?: string
          id?: string
          marks?: number
          options?: Json | null
          order_number?: number
          question_text?: string
          question_type?: Database["public"]["Enums"]["question_type_enum"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          duration_minutes: number | null
          exam_date: string | null
          grade_level: string | null
          id: string
          passing_marks: number
          status: string | null
          subject: string | null
          title: string
          total_marks: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          exam_date?: string | null
          grade_level?: string | null
          id?: string
          passing_marks?: number
          status?: string | null
          subject?: string | null
          title: string
          total_marks?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_minutes?: number | null
          exam_date?: string | null
          grade_level?: string | null
          id?: string
          passing_marks?: number
          status?: string | null
          subject?: string | null
          title?: string
          total_marks?: number
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          recipient_id: string | null
          recipient_role: string
          sender_id: string
          sender_role: string
        }
        Insert: {
          content: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_id?: string | null
          recipient_role?: string
          sender_id: string
          sender_role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_id?: string | null
          recipient_role?: string
          sender_id?: string
          sender_role?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      page_views: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          device_type: string | null
          duration_seconds: number | null
          event_data: Json | null
          event_type: string
          id: string
          os: string | null
          page_path: string
          page_title: string | null
          referrer: string | null
          session_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          duration_seconds?: number | null
          event_data?: Json | null
          event_type?: string
          id?: string
          os?: string | null
          page_path: string
          page_title?: string | null
          referrer?: string | null
          session_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          device_type?: string | null
          duration_seconds?: number | null
          event_data?: Json | null
          event_type?: string
          id?: string
          os?: string | null
          page_path?: string
          page_title?: string | null
          referrer?: string | null
          session_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      parents: {
        Row: {
          access_code: string
          created_at: string | null
          email: string
          full_name: string
          id: string
          last_login: string | null
          phone_number: string | null
          relationship_to_student: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_code: string
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          last_login?: string | null
          phone_number?: string | null
          relationship_to_student?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_code?: string
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          last_login?: string | null
          phone_number?: string | null
          relationship_to_student?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token: string
          used: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          token: string
          used?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token?: string
          used?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      registration_keys: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          class_id: string
          created_at: string
          created_by: string
          id: string
          key_code: string
          school_id: string
          status: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          class_id: string
          created_at?: string
          created_by: string
          id?: string
          key_code: string
          school_id: string
          status?: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          class_id?: string
          created_at?: string
          created_by?: string
          id?: string
          key_code?: string
          school_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "registration_keys_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_keys_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registration_keys_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      resit_openings: {
        Row: {
          class_id: string
          created_at: string | null
          deadline: string | null
          exam_id: string
          id: string
          is_open: boolean | null
          opened_by: string | null
        }
        Insert: {
          class_id: string
          created_at?: string | null
          deadline?: string | null
          exam_id: string
          id?: string
          is_open?: boolean | null
          opened_by?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string | null
          deadline?: string | null
          exam_id?: string
          id?: string
          is_open?: boolean | null
          opened_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resit_openings_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resit_openings_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      resit_requests: {
        Row: {
          admin_note: string | null
          class_id: string
          created_at: string | null
          exam_id: string
          id: string
          requested_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          student_id: string
        }
        Insert: {
          admin_note?: string | null
          class_id: string
          created_at?: string | null
          exam_id: string
          id?: string
          requested_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          student_id: string
        }
        Update: {
          admin_note?: string | null
          class_id?: string
          created_at?: string | null
          exam_id?: string
          id?: string
          requested_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resit_requests_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resit_requests_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resit_requests_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          city: string | null
          code: string
          country: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          account_status: string | null
          address_city: string | null
          address_country: string | null
          class_id: string | null
          created_at: string | null
          date_of_birth: string
          email: string | null
          full_name: string
          gender: string | null
          grade: string | null
          id: string
          last_login: string | null
          parent_id: string | null
          phone_number: string | null
          profile_picture_url: string | null
          programming_experience: string | null
          programming_languages: string[] | null
          school_id: string | null
          school_name: string | null
          skill_levels: Json | null
          stem_interests: string[] | null
          student_id_code: string | null
          student_school_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_status?: string | null
          address_city?: string | null
          address_country?: string | null
          class_id?: string | null
          created_at?: string | null
          date_of_birth: string
          email?: string | null
          full_name: string
          gender?: string | null
          grade?: string | null
          id?: string
          last_login?: string | null
          parent_id?: string | null
          phone_number?: string | null
          profile_picture_url?: string | null
          programming_experience?: string | null
          programming_languages?: string[] | null
          school_id?: string | null
          school_name?: string | null
          skill_levels?: Json | null
          stem_interests?: string[] | null
          student_id_code?: string | null
          student_school_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_status?: string | null
          address_city?: string | null
          address_country?: string | null
          class_id?: string | null
          created_at?: string | null
          date_of_birth?: string
          email?: string | null
          full_name?: string
          gender?: string | null
          grade?: string | null
          id?: string
          last_login?: string | null
          parent_id?: string | null
          phone_number?: string | null
          profile_picture_url?: string | null
          programming_experience?: string | null
          programming_languages?: string[] | null
          school_id?: string | null
          school_name?: string | null
          skill_levels?: Json | null
          stem_interests?: string[] | null
          student_id_code?: string | null
          student_school_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "parents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      study_resource_class_assignments: {
        Row: {
          assigned_by: string | null
          class_id: string
          created_at: string
          id: string
          resource_id: string
        }
        Insert: {
          assigned_by?: string | null
          class_id: string
          created_at?: string
          id?: string
          resource_id: string
        }
        Update: {
          assigned_by?: string | null
          class_id?: string
          created_at?: string
          id?: string
          resource_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_resource_class_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_resource_class_assignments_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "study_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      study_resources: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          duration_seconds: number | null
          external_url: string | null
          file_path: string | null
          file_size: number | null
          grade_level: string | null
          id: string
          is_published: boolean
          resource_type: Database["public"]["Enums"]["study_resource_type"]
          subject: string | null
          title: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          external_url?: string | null
          file_path?: string | null
          file_size?: number | null
          grade_level?: string | null
          id?: string
          is_published?: boolean
          resource_type: Database["public"]["Enums"]["study_resource_type"]
          subject?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration_seconds?: number | null
          external_url?: string | null
          file_path?: string | null
          file_size?: number | null
          grade_level?: string | null
          id?: string
          is_published?: boolean
          resource_type?: Database["public"]["Enums"]["study_resource_type"]
          subject?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      teacher_class_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          class_id: string
          id: string
          subject: string
          teacher_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          class_id: string
          id?: string
          subject: string
          teacher_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          class_id?: string
          id?: string
          subject?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_class_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_class_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          phone_number: string | null
          school_id: string | null
          status: string
          subject_specialty: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id?: string
          phone_number?: string | null
          school_id?: string | null
          status?: string
          subject_specialty?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          phone_number?: string | null
          school_id?: string | null
          status?: string
          subject_specialty?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teachers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string | null
          email_notifications: boolean | null
          id: string
          language: string | null
          notifications_enabled: boolean | null
          onboarding_completed: boolean | null
          theme: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_notifications?: boolean | null
          id?: string
          language?: string | null
          notifications_enabled?: boolean | null
          onboarding_completed?: boolean | null
          theme?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_notifications?: boolean | null
          id?: string
          language?: string | null
          notifications_enabled?: boolean | null
          onboarding_completed?: boolean | null
          theme?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_request_resit: {
        Args: { _exam_id: string; _student_id: string }
        Returns: boolean
      }
      can_review_attempt: { Args: { _attempt_id: string }; Returns: boolean }
      get_student_class_id: { Args: { _user_id: string }; Returns: string }
      get_student_parent_id: { Args: { _user_id: string }; Returns: string }
      get_teacher_class_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_teacher: { Args: { _user_id: string }; Returns: boolean }
      mark_review_opened: { Args: { _attempt_id: string }; Returns: undefined }
      validate_registration_key: {
        Args: { _key_code: string }
        Returns: {
          class_name: string
          key_code: string
          school_name: string
        }[]
      }
    }
    Enums: {
      app_role: "student" | "parent" | "admin" | "teacher"
      question_type_enum:
        | "multiple_choice"
        | "true_false"
        | "short_answer"
        | "essay"
      study_resource_type: "book" | "video" | "worksheet"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["student", "parent", "admin", "teacher"],
      question_type_enum: [
        "multiple_choice",
        "true_false",
        "short_answer",
        "essay",
      ],
      study_resource_type: ["book", "video", "worksheet"],
    },
  },
} as const
