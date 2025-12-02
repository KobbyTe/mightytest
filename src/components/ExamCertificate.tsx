import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface ExamCertificateProps {
  studentName: string;
  examTitle: string;
  score: number;
  totalMarks: number;
  date: string;
}

export function ExamCertificate({ studentName, examTitle, score, totalMarks, date }: ExamCertificateProps) {
  const handleDownload = () => {
    const certificateElement = document.getElementById('certificate-content');
    if (!certificateElement) return;

    // Use html2canvas and jsPDF for PDF generation
    import('html2canvas').then((html2canvas) => {
      import('jspdf').then((jsPDF) => {
        html2canvas.default(certificateElement, {
          scale: 2,
          backgroundColor: '#ffffff',
        }).then((canvas) => {
          const imgData = canvas.toDataURL('image/png');
          const pdf = new jsPDF.default({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4',
          });
          
          const imgWidth = 297; // A4 landscape width in mm
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          
          pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
          pdf.save(`${examTitle}-Certificate-${studentName}.pdf`);
        });
      });
    });
  };

  const percentage = Math.round((score / totalMarks) * 100);

  return (
    <div className="space-y-4">
      <div 
        id="certificate-content"
        className="bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-12 rounded-lg border-4 border-primary/20 shadow-2xl"
        style={{ width: '800px', height: '600px' }}
      >
        <div className="h-full flex flex-col items-center justify-center text-center space-y-6 relative">
          {/* Decorative corners */}
          <div className="absolute top-4 left-4 w-16 h-16 border-t-4 border-l-4 border-primary/40 rounded-tl-lg" />
          <div className="absolute top-4 right-4 w-16 h-16 border-t-4 border-r-4 border-primary/40 rounded-tr-lg" />
          <div className="absolute bottom-4 left-4 w-16 h-16 border-b-4 border-l-4 border-primary/40 rounded-bl-lg" />
          <div className="absolute bottom-4 right-4 w-16 h-16 border-b-4 border-r-4 border-primary/40 rounded-br-lg" />

          {/* Content */}
          <div className="text-6xl">🏆</div>
          
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-primary">Certificate of Achievement</h1>
            <p className="text-lg text-muted-foreground">STEM Academy</p>
          </div>

          <div className="py-6 space-y-4">
            <p className="text-lg">This is to certify that</p>
            <h2 className="text-5xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              {studentName}
            </h2>
            <p className="text-lg">has successfully completed</p>
            <h3 className="text-3xl font-semibold text-foreground">
              {examTitle}
            </h3>
          </div>

          <div className="flex gap-8 items-center justify-center py-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">{percentage}%</div>
              <div className="text-sm text-muted-foreground">Score Achieved</div>
            </div>
            <div className="w-px h-16 bg-border" />
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">{score}/{totalMarks}</div>
              <div className="text-sm text-muted-foreground">Total Marks</div>
            </div>
          </div>

          <div className="pt-6 space-y-2">
            <p className="text-sm text-muted-foreground">Awarded on {new Date(date).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</p>
          </div>

          <div className="pt-8 flex gap-16">
            <div className="text-center">
              <div className="border-t-2 border-foreground/20 pt-2 px-8">
                <p className="text-sm font-semibold">Director Signature</p>
              </div>
            </div>
            <div className="text-center">
              <div className="border-t-2 border-foreground/20 pt-2 px-8">
                <p className="text-sm font-semibold">Instructor Signature</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Button onClick={handleDownload} className="w-full" size="lg">
        <Download className="mr-2 h-5 w-5" />
        Download Certificate PDF
      </Button>
    </div>
  );
}
