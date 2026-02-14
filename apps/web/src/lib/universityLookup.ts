import { supabase } from './supabaseClient'

export type UniversityLookupRow = {
  id: string
  name: string
  email_domains?: string[] | null
  allowed_email_domains?: string[] | null
}

export type SchoolLookupRow = {
  id: string
  name: string
  university_id: string
}

export type DepartmentLookupRow = {
  id: string
  name: string
  school_id: string
}

type UniversityLookupError = {
  message: string
}

const uniqueById = <T extends { id: string }>(items: T[]) =>
  Array.from(new Map(items.map((item) => [item.id, item])).values())

const CENTRAL_SCHOOL_NAME = 'Κεντρική Σχολή'

const cleanSchools = (rows: SchoolLookupRow[]) => {
  const sorted = uniqueById(rows).sort((a, b) => a.name.localeCompare(b.name))
  const hasNamedSchool = sorted.some((row) => row.name !== CENTRAL_SCHOOL_NAME)
  if (!hasNamedSchool) return sorted
  return sorted.filter((row) => row.name !== CENTRAL_SCHOOL_NAME)
}

const cleanDepartments = (rows: DepartmentLookupRow[]) =>
  uniqueById(rows).sort((a, b) => a.name.localeCompare(b.name))

const hasMissingRelationError = (message: string | null | undefined) => {
  const normalized = (message ?? '').toLowerCase()
  return normalized.includes('does not exist') || normalized.includes('could not find the table')
}

const hasMissingFunctionError = (message: string | null | undefined) => {
  const normalized = (message ?? '').toLowerCase()
  return normalized.includes('function') && normalized.includes('get_universities_for_city')
}

const hasMissingSchoolsFunctionError = (message: string | null | undefined) => {
  const normalized = (message ?? '').toLowerCase()
  return normalized.includes('function') && normalized.includes('get_schools_for_university_city')
}

const hasMissingDepartmentsFunctionError = (message: string | null | undefined) => {
  const normalized = (message ?? '').toLowerCase()
  return normalized.includes('function') && normalized.includes('get_departments_for_school_city')
}

export async function fetchUniversitiesForCity(
  cityId: string,
  options?: { withDomains?: boolean },
): Promise<{ data: UniversityLookupRow[]; error: UniversityLookupError | null }> {
  const rpcResponse = await supabase.rpc('get_universities_for_city', {
    p_city_id: cityId,
  })

  if (!rpcResponse.error) {
    const rpcRows = ((rpcResponse.data ?? []) as UniversityLookupRow[]).sort((a, b) =>
      a.name.localeCompare(b.name),
    )

    if (options?.withDomains) {
      return { data: rpcRows, error: null }
    }

    return {
      data: rpcRows.map((row) => ({ id: row.id, name: row.name })),
      error: null,
    }
  }

  if (
    !hasMissingFunctionError(rpcResponse.error.message) &&
    !hasMissingRelationError(rpcResponse.error.message)
  ) {
    return { data: [], error: { message: rpcResponse.error.message } }
  }

  const selectColumns = options?.withDomains
    ? 'id,name,email_domains,allowed_email_domains'
    : 'id,name'

  const directResponse = await supabase
    .from('universities')
    .select(selectColumns)
    .eq('city_id', cityId)

  if (directResponse.error) {
    return { data: [], error: { message: directResponse.error.message } }
  }

  const directRows = (directResponse.data ?? []) as unknown as UniversityLookupRow[]

  const departmentsResponse = await supabase
    .from('departments')
    .select('school_id')
    .eq('city_id', cityId)

  if (departmentsResponse.error) {
    if (hasMissingRelationError(departmentsResponse.error.message)) {
      return {
        data: [...directRows].sort((a, b) => a.name.localeCompare(b.name)),
        error: null,
      }
    }
    return { data: [], error: { message: departmentsResponse.error.message } }
  }

  const schoolIds = Array.from(
    new Set(
      ((departmentsResponse.data ?? []) as Array<{ school_id: string | null }>)
        .map((row) => row.school_id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0),
    ),
  )

  if (schoolIds.length === 0) {
    return {
      data: [...directRows].sort((a, b) => a.name.localeCompare(b.name)),
      error: null,
    }
  }

  const schoolsResponse = await supabase
    .from('schools')
    .select('university_id')
    .in('id', schoolIds)

  if (schoolsResponse.error) {
    return { data: [], error: { message: schoolsResponse.error.message } }
  }

  const universityIds = Array.from(
    new Set(
      ((schoolsResponse.data ?? []) as Array<{ university_id: string | null }>)
        .map((row) => row.university_id)
        .filter((value): value is string => typeof value === 'string' && value.length > 0),
    ),
  )

  if (universityIds.length === 0) {
    return {
      data: [...directRows].sort((a, b) => a.name.localeCompare(b.name)),
      error: null,
    }
  }

  const campusResponse = await supabase
    .from('universities')
    .select(selectColumns)
    .in('id', universityIds)

  if (campusResponse.error) {
    return { data: [], error: { message: campusResponse.error.message } }
  }

  const merged = uniqueById([
    ...directRows,
    ...((campusResponse.data ?? []) as unknown as UniversityLookupRow[]),
  ]).sort((a, b) => a.name.localeCompare(b.name))

  return { data: merged, error: null }
}

export async function fetchSchoolsForUniversity(
  universityId: string,
  options?: { cityId?: string | null },
): Promise<{ data: SchoolLookupRow[]; error: UniversityLookupError | null }> {
  const rpcResponse = await supabase.rpc('get_schools_for_university_city', {
    p_university_id: universityId,
    p_city_id: options?.cityId ?? null,
  })

  if (!rpcResponse.error) {
    return {
      data: cleanSchools((rpcResponse.data ?? []) as SchoolLookupRow[]),
      error: null,
    }
  }

  if (
    !hasMissingSchoolsFunctionError(rpcResponse.error.message) &&
    !hasMissingRelationError(rpcResponse.error.message)
  ) {
    return { data: [], error: { message: rpcResponse.error.message } }
  }

  const baseResponse = await supabase
    .from('schools')
    .select('id, name, university_id')
    .eq('university_id', universityId)
    .order('name', { ascending: true })

  if (baseResponse.error) {
    return { data: [], error: { message: baseResponse.error.message } }
  }

  const allSchools = (baseResponse.data ?? []) as SchoolLookupRow[]
  const cleanAllSchools = cleanSchools(allSchools)

  if (!options?.cityId || allSchools.length === 0) {
    return { data: cleanAllSchools, error: null }
  }

  const departmentResponse = await supabase
    .from('departments')
    .select('school_id')
    .eq('city_id', options.cityId)
    .in(
      'school_id',
      allSchools.map((row) => row.id),
    )

  if (departmentResponse.error) {
    if (hasMissingRelationError(departmentResponse.error.message)) {
      return { data: cleanAllSchools, error: null }
    }
    return { data: [], error: { message: departmentResponse.error.message } }
  }

  const citySchoolIds = new Set(
    ((departmentResponse.data ?? []) as Array<{ school_id: string | null }>)
      .map((row) => row.school_id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  )

  if (citySchoolIds.size === 0) {
    return { data: cleanAllSchools, error: null }
  }

  const citySchools = cleanSchools(allSchools.filter((school) => citySchoolIds.has(school.id)))
  if (citySchools.length === 0) {
    return { data: cleanAllSchools, error: null }
  }

  return { data: citySchools, error: null }
}

export async function fetchDepartmentsForSchool(
  schoolId: string,
  options?: { cityId?: string | null },
): Promise<{ data: DepartmentLookupRow[]; error: UniversityLookupError | null }> {
  const cityId = options?.cityId ?? null
  const rpcResponse = await supabase.rpc('get_departments_for_school_city', {
    p_school_id: schoolId,
    p_city_id: cityId,
  })

  if (!rpcResponse.error) {
    return {
      data: cleanDepartments((rpcResponse.data ?? []) as DepartmentLookupRow[]),
      error: null,
    }
  }

  if (
    !hasMissingDepartmentsFunctionError(rpcResponse.error.message) &&
    !hasMissingRelationError(rpcResponse.error.message)
  ) {
    return { data: [], error: { message: rpcResponse.error.message } }
  }

  let byCityQuery = supabase
    .from('departments')
    .select('id, name, school_id')
    .eq('school_id', schoolId)
    .order('name', { ascending: true })

  if (cityId) {
    byCityQuery = byCityQuery.eq('city_id', cityId)
  }

  const byCityResponse = await byCityQuery

  if (byCityResponse.error) {
    if (!hasMissingRelationError(byCityResponse.error.message)) {
      return { data: [], error: { message: byCityResponse.error.message } }
    }

    return { data: [], error: null }
  }

  const cityRows = cleanDepartments((byCityResponse.data ?? []) as DepartmentLookupRow[])
  if (!cityId || cityRows.length > 0) {
    return { data: cityRows, error: null }
  }

  const fallbackResponse = await supabase
    .from('departments')
    .select('id, name, school_id')
    .eq('school_id', schoolId)
    .order('name', { ascending: true })

  if (fallbackResponse.error) {
    return { data: [], error: { message: fallbackResponse.error.message } }
  }

  return {
    data: cleanDepartments((fallbackResponse.data ?? []) as DepartmentLookupRow[]),
    error: null,
  }
}
