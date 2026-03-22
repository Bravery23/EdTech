#!/bin/bash

BASE_URL="http://localhost:8000/api/v1"

echo "=== 1. Register Users ==="
# Admin
ADMIN_RES=$(curl -s -X POST "$BASE_URL/auth/register" -H "Content-Type: application/json" -d '{"email": "admin99@school.edu.vn", "password": "password", "full_name": "Admin", "role": ["admin"]}')
echo "Admin: $ADMIN_RES"
ADMIN_ID=$(echo $ADMIN_RES | jq -r .id)

# Teacher
TEACHER_RES=$(curl -s -X POST "$BASE_URL/auth/register" -H "Content-Type: application/json" -d '{"email": "teacher99@school.edu.vn", "password": "password", "full_name": "Teacher Ly", "role": ["subject_teacher"]}')
echo "Teacher: $TEACHER_RES"
TEACHER_ID=$(echo $TEACHER_RES | jq -r .id)

# Parent
PARENT_RES=$(curl -s -X POST "$BASE_URL/auth/register" -H "Content-Type: application/json" -d '{"email": "parent99@gmail.com", "password": "password", "full_name": "Phu huynh", "role": ["parent"]}')
echo "Parent: $PARENT_RES"
PARENT_ID=$(echo $PARENT_RES | jq -r .id)

# Student
STUDENT_RES=$(curl -s -X POST "$BASE_URL/auth/register" -H "Content-Type: application/json" -d '{"email": "student99@school.edu.vn", "password": "password", "full_name": "Hoc sinh", "role": ["student"]}')
echo "Student: $STUDENT_RES"
STUDENT_ID=$(echo $STUDENT_RES | jq -r .id)

echo -e "\n=== 2. Login as Admin ==="
ADMIN_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" -H "Content-Type: application/x-www-form-urlencoded" -d "username=admin99@school.edu.vn&password=password" | jq -r .access_token)
echo "Got Admin Token"

echo -e "\n=== 2.5 Create Subject ==="
SUBJECT_RES=$(curl -s -X POST "$BASE_URL/subjects/" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"name": "Vật lý", "code": "PHY"}')
echo "Subject: $SUBJECT_RES"
SUBJECT_ID=$(echo $SUBJECT_RES | jq -r .id)

echo -e "\n=== 3. Link Parent & Student ==="
curl -s -X POST "$BASE_URL/users/$PARENT_ID/students/$STUDENT_ID" -H "Authorization: Bearer $ADMIN_TOKEN"
echo " Linked Parent to Student"

echo -e "\n=== 4. Create Class ==="
CLASS_RES=$(curl -s -X POST "$BASE_URL/classes/" -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" -d '{"name": "10A1", "grade_level": 10, "academic_year": "2023-2024"}')
echo "Class: $CLASS_RES"
CLASS_ID=$(echo $CLASS_RES | jq -r .id)

echo -e "\n=== 5. Assign Student to Class ==="
curl -s -X POST "$BASE_URL/classes/$CLASS_ID/students/$STUDENT_ID" -H "Authorization: Bearer $ADMIN_TOKEN"
echo " Assigned Student"

echo -e "\n=== 6. Assign Teacher to Class (Vật lý) ==="
curl -s -X POST "$BASE_URL/classes/$CLASS_ID/teachers/$TEACHER_ID?subject_id=$SUBJECT_ID" -H "Authorization: Bearer $ADMIN_TOKEN"
echo " Assigned Teacher"

echo -e "\n=== 7. Login as Teacher ==="
TEACHER_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" -H "Content-Type: application/x-www-form-urlencoded" -d "username=teacher99@school.edu.vn&password=password" | jq -r .access_token)
echo "Got Teacher Token"

echo -e "\n=== 8. Enter Grade ==="
GRADE_RES=$(curl -s -X POST "$BASE_URL/grades/" -H "Authorization: Bearer $TEACHER_TOKEN" -H "Content-Type: application/json" -d '{"student_id": '$STUDENT_ID', "subject_id": '$SUBJECT_ID', "semester": 1, "academic_year": "2023-2024", "exam_type": "15p", "score": 8.5, "comments": "Làm bài tốt"}')
echo "Grade: $GRADE_RES"

echo -e "\n=== 9. Login as Parent ==="
PARENT_TOKEN=$(curl -s -X POST "$BASE_URL/auth/login" -H "Content-Type: application/x-www-form-urlencoded" -d "username=parent99@gmail.com&password=password" | jq -r .access_token)
echo "Got Parent Token"

echo -e "\n=== 10. Test Parent RAG (Query Grades) ==="
curl -s -X POST "$BASE_URL/rag/message" -H "Authorization: Bearer $PARENT_TOKEN" -H "Content-Type: application/json" -d '{"query": "Báo cáo cho tôi tình hình điểm số của con tôi tuần này.", "role": "parent"}' | jq .
