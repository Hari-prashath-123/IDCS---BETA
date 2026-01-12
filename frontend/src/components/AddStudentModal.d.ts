import React from 'react';

interface AddStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStudentAdded?: () => void;
}

declare const AddStudentModal: React.FC<AddStudentModalProps>;
export default AddStudentModal;
