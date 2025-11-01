import { useState } from 'react';
import { Button, Input, Select, Badge } from './components/atoms';
import { ControlGroup, SearchBar } from './components/molecules';
import { Search, Settings, BookOpen } from 'lucide-react';

function App() {
  const [inputValue, setInputValue] = useState('');
  const [selectValue, setSelectValue] = useState('beginner');
  const [searchValue, setSearchValue] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    difficulty: 'beginner',
    description: '',
    acceptTerms: false,
  });

  const difficultyOptions = [
    { value: 'beginner', label: 'Beginner' },
    { value: 'intermediate', label: 'Intermediate' },
    { value: 'advanced', label: 'Advanced' },
    { value: 'expert', label: 'Expert' },
  ];

  const handleSearch = (query: string) => {
    console.log('Searching for:', query);
    alert(`Searching for: ${query}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      <header className="bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen size={32} />
              <h1 className="text-3xl font-bold">Word Discoverer</h1>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/20">
                <Settings size={18} />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Molecule Components Demo */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Molecule Components</h2>
            
            <div className="space-y-6">
              {/* SearchBar */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-700">SearchBar</h3>
                <SearchBar
                  value={searchValue}
                  onChange={setSearchValue}
                  onSearch={handleSearch}
                  placeholder="Search for words..."
                />
              </div>

              {/* ControlGroup - Form Example */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-700">ControlGroup (Form)</h3>
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <ControlGroup
                    type="input"
                    label="Username"
                    required
                    inputProps={{
                      placeholder: 'Enter your username',
                      value: formData.username,
                      onChange: (e) => setFormData({ ...formData, username: e.target.value }),
                    }}
                    helperText="At least 3 characters"
                  />
                  
                  <ControlGroup
                    type="select"
                    label="Difficulty Level"
                    selectProps={{
                      options: difficultyOptions,
                      value: formData.difficulty,
                      onChange: (e) => setFormData({ ...formData, difficulty: e.target.value }),
                    }}
                  />
                  
                  <ControlGroup
                    type="textarea"
                    label="Description"
                    textareaProps={{
                      placeholder: 'Tell us about yourself...',
                      rows: 3,
                      value: formData.description,
                      onChange: (e) => setFormData({ ...formData, description: e.target.value }),
                    }}
                  />
                  
                  <ControlGroup
                    type="checkbox"
                    checkboxLabel="I accept the terms and conditions"
                    required
                    checked={formData.acceptTerms}
                    onChange={(checked) => setFormData({ ...formData, acceptTerms: checked })}
                  />
                  
                  <Button variant="primary" disabled={!formData.acceptTerms}>
                    Submit Form
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Atomic Components Demo */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Atomic Components</h2>
            
            <div className="space-y-6">
              {/* Button Variants */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-700">Buttons</h3>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary">
                    <Search size={16} />
                    Primary
                  </Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="danger">Danger</Button>
                  <Button variant="success">Success</Button>
                  <Button loading>Loading...</Button>
                </div>
              </div>

              {/* Input */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-700">Input</h3>
                <Input
                  label="Enter your text"
                  placeholder="Type something..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  helperText="This is a helper text"
                />
              </div>

              {/* Select */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-700">Select</h3>
                <Select
                  label="Difficulty Level"
                  options={difficultyOptions}
                  value={selectValue}
                  onChange={(e) => setSelectValue(e.target.value)}
                />
              </div>

              {/* Badges */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-700">Badges</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default">Default</Badge>
                  <Badge variant="primary">Primary</Badge>
                  <Badge variant="success">Success</Badge>
                  <Badge variant="warning">Warning</Badge>
                  <Badge variant="error">Error</Badge>
                  <Badge variant="info">Info</Badge>
                  <Badge variant="success" closeable onClose={() => console.log('Closed')}>
                    Closeable
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">About</h2>
            <p className="text-gray-600 mb-4">
              This is the React + TypeScript migration of the Word Discoverer application,
              following the Atomic Design methodology.
            </p>
            <div className="flex gap-2">
              <Badge variant="primary">React 18</Badge>
              <Badge variant="secondary">TypeScript</Badge>
              <Badge variant="info">Tailwind CSS</Badge>
              <Badge variant="success">Atomic Design</Badge>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
