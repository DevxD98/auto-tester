import { NextRequest, NextResponse } from 'next/server';

// In-memory credential storage (for development)
// TODO: Replace with secure encrypted storage in production
const credentialStore = new Map<string, { username: string; password: string; created: number; }>();

export async function POST(request: NextRequest) {
  try {
    const { name, username, password } = await request.json();
    
    if (!name || !username || !password) {
      return NextResponse.json({ 
        error: 'Name, username, and password are required' 
      }, { status: 400 });
    }

    credentialStore.set(name, {
      username,
      password,
      created: Date.now()
    });

    return NextResponse.json({ 
      message: 'Credentials saved successfully',
      name 
    });
  } catch (error) {
    console.error('Failed to save credentials:', error);
    return NextResponse.json(
      { error: 'Failed to save credentials' }, 
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    
    if (name) {
      const creds = credentialStore.get(name);
      if (!creds) {
        return NextResponse.json({ 
          error: 'Credentials not found' 
        }, { status: 404 });
      }
      
      return NextResponse.json({
        name,
        username: creds.username,
        // Never return password in GET requests
        hasPassword: !!creds.password,
        created: creds.created
      });
    }
    
    // Return list of credential names (without sensitive data)
    const credentialNames = Array.from(credentialStore.keys()).map(name => ({
      name,
      username: credentialStore.get(name)?.username,
      created: credentialStore.get(name)?.created
    }));
    
    return NextResponse.json({ credentials: credentialNames });
  } catch (error) {
    console.error('Failed to fetch credentials:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credentials' }, 
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    
    if (!name) {
      return NextResponse.json({ 
        error: 'Credential name is required' 
      }, { status: 400 });
    }
    
    const deleted = credentialStore.delete(name);
    
    if (!deleted) {
      return NextResponse.json({ 
        error: 'Credentials not found' 
      }, { status: 404 });
    }
    
    return NextResponse.json({ 
      message: 'Credentials deleted successfully',
      name 
    });
  } catch (error) {
    console.error('Failed to delete credentials:', error);
    return NextResponse.json(
      { error: 'Failed to delete credentials' }, 
      { status: 500 }
    );
  }
}