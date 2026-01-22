import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Building2, Plus, Edit2, Trash2, Users, GraduationCap, Search, Filter } from 'lucide-react';
import { Loader2 } from 'lucide-react';

interface School {
  id: string;
  name: string;
  code: string;
  address: string | null;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  status: string;
  created_at: string;
}

interface Class {
  id: string;
  school_id: string;
  name: string;
  grade_level: string | null;
  description: string | null;
  status: string;
  created_at: string;
  school?: School;
}

export default function SchoolManagement() {
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchool, setSelectedSchool] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showSchoolDialog, setShowSchoolDialog] = useState(false);
  const [showClassDialog, setShowClassDialog] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [saving, setSaving] = useState(false);

  const [schoolForm, setSchoolForm] = useState({
    name: '',
    code: '',
    address: '',
    city: '',
    country: '',
    phone: '',
    email: ''
  });

  const [classForm, setClassForm] = useState({
    school_id: '',
    name: '',
    grade_level: '',
    description: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [schoolsRes, classesRes] = await Promise.all([
        supabase.from('schools').select('*').order('name'),
        supabase.from('classes').select('*, school:schools(*)').order('name')
      ]);

      if (schoolsRes.error) throw schoolsRes.error;
      if (classesRes.error) throw classesRes.error;

      setSchools(schoolsRes.data || []);
      setClasses(classesRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load schools and classes');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSchool = async () => {
    if (!schoolForm.name || !schoolForm.code) {
      toast.error('Name and code are required');
      return;
    }

    setSaving(true);
    try {
      if (editingSchool) {
        const { error } = await supabase
          .from('schools')
          .update(schoolForm)
          .eq('id', editingSchool.id);
        if (error) throw error;
        toast.success('School updated successfully');
      } else {
        const { error } = await supabase
          .from('schools')
          .insert(schoolForm);
        if (error) throw error;
        toast.success('School created successfully');
      }

      setShowSchoolDialog(false);
      resetSchoolForm();
      loadData();
    } catch (error: any) {
      console.error('Error saving school:', error);
      toast.error(error.message || 'Failed to save school');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClass = async () => {
    if (!classForm.school_id || !classForm.name) {
      toast.error('School and class name are required');
      return;
    }

    setSaving(true);
    try {
      if (editingClass) {
        const { error } = await supabase
          .from('classes')
          .update(classForm)
          .eq('id', editingClass.id);
        if (error) throw error;
        toast.success('Class updated successfully');
      } else {
        const { error } = await supabase
          .from('classes')
          .insert(classForm);
        if (error) throw error;
        toast.success('Class created successfully');
      }

      setShowClassDialog(false);
      resetClassForm();
      loadData();
    } catch (error: any) {
      console.error('Error saving class:', error);
      toast.error(error.message || 'Failed to save class');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSchool = async (school: School) => {
    if (!confirm(`Delete ${school.name}? This will also delete all classes in this school.`)) return;

    try {
      const { error } = await supabase.from('schools').delete().eq('id', school.id);
      if (error) throw error;
      toast.success('School deleted successfully');
      loadData();
    } catch (error) {
      console.error('Error deleting school:', error);
      toast.error('Failed to delete school');
    }
  };

  const handleDeleteClass = async (cls: Class) => {
    if (!confirm(`Delete ${cls.name}?`)) return;

    try {
      const { error } = await supabase.from('classes').delete().eq('id', cls.id);
      if (error) throw error;
      toast.success('Class deleted successfully');
      loadData();
    } catch (error) {
      console.error('Error deleting class:', error);
      toast.error('Failed to delete class');
    }
  };

  const resetSchoolForm = () => {
    setSchoolForm({ name: '', code: '', address: '', city: '', country: '', phone: '', email: '' });
    setEditingSchool(null);
  };

  const resetClassForm = () => {
    setClassForm({ school_id: '', name: '', grade_level: '', description: '' });
    setEditingClass(null);
  };

  const openEditSchool = (school: School) => {
    setSchoolForm({
      name: school.name,
      code: school.code,
      address: school.address || '',
      city: school.city || '',
      country: school.country || '',
      phone: school.phone || '',
      email: school.email || ''
    });
    setEditingSchool(school);
    setShowSchoolDialog(true);
  };

  const openEditClass = (cls: Class) => {
    setClassForm({
      school_id: cls.school_id,
      name: cls.name,
      grade_level: cls.grade_level || '',
      description: cls.description || ''
    });
    setEditingClass(cls);
    setShowClassDialog(true);
  };

  const filteredClasses = classes.filter(cls => {
    const matchesSchool = selectedSchool === 'all' || cls.school_id === selectedSchool;
    const matchesSearch = cls.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (cls.school as any)?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSchool && matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Schools Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Schools
            </CardTitle>
            <CardDescription>Manage registered schools</CardDescription>
          </div>
          <Dialog open={showSchoolDialog} onOpenChange={(open) => {
            setShowSchoolDialog(open);
            if (!open) resetSchoolForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add School
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingSchool ? 'Edit School' : 'Add New School'}</DialogTitle>
                <DialogDescription>
                  {editingSchool ? 'Update school information' : 'Create a new school in the system'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="schoolName">School Name *</Label>
                    <Input
                      id="schoolName"
                      value={schoolForm.name}
                      onChange={(e) => setSchoolForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Springfield High School"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schoolCode">School Code *</Label>
                    <Input
                      id="schoolCode"
                      value={schoolForm.code}
                      onChange={(e) => setSchoolForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                      placeholder="SHS001"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schoolAddress">Address</Label>
                  <Input
                    id="schoolAddress"
                    value={schoolForm.address}
                    onChange={(e) => setSchoolForm(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="123 Main Street"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="schoolCity">City</Label>
                    <Input
                      id="schoolCity"
                      value={schoolForm.city}
                      onChange={(e) => setSchoolForm(prev => ({ ...prev, city: e.target.value }))}
                      placeholder="Springfield"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schoolCountry">Country</Label>
                    <Input
                      id="schoolCountry"
                      value={schoolForm.country}
                      onChange={(e) => setSchoolForm(prev => ({ ...prev, country: e.target.value }))}
                      placeholder="United States"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="schoolPhone">Phone</Label>
                    <Input
                      id="schoolPhone"
                      value={schoolForm.phone}
                      onChange={(e) => setSchoolForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+1 234 567 8900"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schoolEmail">Email</Label>
                    <Input
                      id="schoolEmail"
                      type="email"
                      value={schoolForm.email}
                      onChange={(e) => setSchoolForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="info@school.edu"
                    />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowSchoolDialog(false)}>Cancel</Button>
                <Button onClick={handleSaveSchool} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingSchool ? 'Update' : 'Create'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schools.map(school => (
                <TableRow key={school.id}>
                  <TableCell className="font-medium">{school.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{school.code}</Badge>
                  </TableCell>
                  <TableCell>{school.city ? `${school.city}, ${school.country || ''}` : '-'}</TableCell>
                  <TableCell>
                    <Badge variant={school.status === 'active' ? 'default' : 'secondary'}>
                      {school.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEditSchool(school)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteSchool(school)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {schools.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No schools registered yet. Add your first school above.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Classes Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Classes
            </CardTitle>
            <CardDescription>Manage classes within schools</CardDescription>
          </div>
          <Dialog open={showClassDialog} onOpenChange={(open) => {
            setShowClassDialog(open);
            if (!open) resetClassForm();
          }}>
            <DialogTrigger asChild>
              <Button disabled={schools.length === 0}>
                <Plus className="h-4 w-4 mr-2" />
                Add Class
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingClass ? 'Edit Class' : 'Add New Class'}</DialogTitle>
                <DialogDescription>
                  {editingClass ? 'Update class information' : 'Create a new class for a school'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="classSchool">School *</Label>
                  <Select
                    value={classForm.school_id}
                    onValueChange={(value) => setClassForm(prev => ({ ...prev, school_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a school" />
                    </SelectTrigger>
                    <SelectContent>
                      {schools.map(school => (
                        <SelectItem key={school.id} value={school.id}>
                          {school.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="className">Class Name *</Label>
                    <Input
                      id="className"
                      value={classForm.name}
                      onChange={(e) => setClassForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="10A"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gradeLevel">Grade Level</Label>
                    <Input
                      id="gradeLevel"
                      value={classForm.grade_level}
                      onChange={(e) => setClassForm(prev => ({ ...prev, grade_level: e.target.value }))}
                      placeholder="Grade 10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="classDescription">Description</Label>
                  <Textarea
                    id="classDescription"
                    value={classForm.description}
                    onChange={(e) => setClassForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional class description..."
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowClassDialog(false)}>Cancel</Button>
                <Button onClick={handleSaveClass} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingClass ? 'Update' : 'Create'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search classes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedSchool} onValueChange={setSelectedSchool}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by school" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Schools</SelectItem>
                {schools.map(school => (
                  <SelectItem key={school.id} value={school.id}>
                    {school.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class Name</TableHead>
                <TableHead>School</TableHead>
                <TableHead>Grade Level</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClasses.map(cls => (
                <TableRow key={cls.id}>
                  <TableCell className="font-medium">{cls.name}</TableCell>
                  <TableCell>{(cls.school as any)?.name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{cls.grade_level || 'N/A'}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={cls.status === 'active' ? 'default' : 'secondary'}>
                      {cls.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEditClass(cls)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteClass(cls)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredClasses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {schools.length === 0 
                      ? 'Add a school first before creating classes.'
                      : 'No classes found. Add your first class above.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
