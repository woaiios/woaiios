/**
 * GoogleDrivePanel - Organism Component
 * Google Drive integration panel for vocabulary synchronization
 */

import { Button } from '../atoms';
import { Cloud, CloudOff, RefreshCw, LogOut, Check, X } from 'lucide-react';
import { useAppStore } from '../../store';
import { useEffect } from 'react';

export function GoogleDrivePanel() {
  const {
    googleDrive,
    initGoogleDrive,
    signInToGoogleDrive,
    signOutFromGoogleDrive,
    syncToGoogleDrive,
    setGoogleDriveAutoSync,
  } = useAppStore();

  // Initialize Google Drive on mount
  useEffect(() => {
    initGoogleDrive();
  }, []);

  const handleSignIn = async () => {
    await signInToGoogleDrive();
  };

  const handleSignOut = async () => {
    await signOutFromGoogleDrive();
  };

  const handleSync = async () => {
    await syncToGoogleDrive();
  };

  const handleToggleAutoSync = () => {
    setGoogleDriveAutoSync(!googleDrive.autoSync);
  };

  const getSyncStatusIcon = () => {
    switch (googleDrive.syncStatus) {
      case 'syncing':
        return <RefreshCw className="w-4 h-4 animate-spin" />;
      case 'success':
        return <Check className="w-4 h-4 text-green-500" />;
      case 'error':
        return <X className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const formatLastSync = (isoString: string | null) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        {googleDrive.isAuthenticated ? (
          <Cloud className="w-8 h-8 text-blue-500" />
        ) : (
          <CloudOff className="w-8 h-8 text-gray-400" />
        )}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Google Drive Sync
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {googleDrive.isAuthenticated
              ? 'Connected - Your vocabulary is synced to Google Drive'
              : 'Backup and sync your vocabulary across devices'}
          </p>
        </div>
      </div>

      {!googleDrive.isAuthenticated ? (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Sign in with your Google account to enable automatic vocabulary backup and 
              synchronization across all your devices.
            </p>
          </div>
          <Button onClick={handleSignIn} className="w-full">
            <Cloud className="w-4 h-4 mr-2" />
            Connect Google Drive
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* User Info */}
          {googleDrive.user && (
            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              {googleDrive.user.photo && (
                <img
                  src={googleDrive.user.photo}
                  alt={googleDrive.user.name}
                  className="w-10 h-10 rounded-full"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {googleDrive.user.name}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                  {googleDrive.user.email}
                </p>
              </div>
            </div>
          )}

          {/* Last Sync Info */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Last Sync
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {formatLastSync(googleDrive.lastSync)}
              </p>
            </div>
            {getSyncStatusIcon()}
          </div>

          {/* Auto Sync Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Auto Sync
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Automatically sync when vocabulary changes
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={googleDrive.autoSync}
                onChange={handleToggleAutoSync}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleSync}
              disabled={googleDrive.syncStatus === 'syncing'}
              className="flex-1"
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${
                  googleDrive.syncStatus === 'syncing' ? 'animate-spin' : ''
                }`}
              />
              Sync Now
            </Button>
            <Button onClick={handleSignOut} variant="outline">
              <LogOut className="w-4 h-4 mr-2" />
              Disconnect
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
